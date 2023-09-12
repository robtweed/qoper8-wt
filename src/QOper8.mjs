/*
 ----------------------------------------------------------------------------
 | QOper8-wt: Queue-based Node.js Worker Thread Pool Manager                 |
 |                                                                           |
 | Copyright (c) 2023 MGateway Ltd,                                          |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | https://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                                |
 |                                                                           |
 |                                                                           |
 | Licensed under the Apache License, Version 2.0 (the "License");           |
 | you may not use this file except in compliance with the License.          |
 | You may obtain a copy of the License at                                   |
 |                                                                           |
 |     http://www.apache.org/licenses/LICENSE-2.0                            |
 |                                                                           |
 | Unless required by applicable law or agreed to in writing, software       |
 | distributed under the License is distributed on an "AS IS" BASIS,         |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  |
 | See the License for the specific language governing permissions and       |
 |  limitations under the License.                                           |
 ----------------------------------------------------------------------------

10 September 2023

 */

// QOper8-wt Worker Thread Code

import {Worker, workerData, threadId} from 'node:worker_threads';
import deq from 'double-ended-queue';
import { v4 as uuidv4 } from 'uuid';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let initialised = false;

class QOper8 {
  constructor(obj) {

    obj = obj || {};

    if (obj.workerInactivityCheckInterval) obj.workerInactivityCheckInterval = obj.workerInactivityCheckInterval * 1000;
    if (obj.workerInactivityLimit) obj.workerInactivityLimit = obj.workerInactivityLimit * 60000;

    this.name = 'QOper8-wt';
    this.build = '6.0';
    this.buildDate = '12 September 2023';
    this.logging = obj.logging || false;
    let poolSize = +obj.poolSize || 1;
    let maxPoolSize = obj.maxPoolSize || 32;
    if (poolSize > maxPoolSize) poolSize = maxPoolSize;
    let inactivityCheckInterval = obj.workerInactivityCheckInterval || 60000;
    let inactivityLimit = obj.workerInactivityLimit || (20 * 60000);

    let handlerTimeout = obj.handlerTimeout || false;
    let handlerTimers = new Map();
    let onStartup = obj.onStartup || {};
    let onStartupModule = onStartup.module;
    let onStartupArguments = onStartup.arguments;

    // QBackup, if present, must be an object
    //  with two functions: add and remove
    //    add(messageNo, requestObj)
    //    delete(messageNo)

    let QBackup = obj.QBackup || false;

    let exitOnStop = obj.exitOnStop || false;
    let stopped = false;
    let startedAt = Date.now();
    let noOfMessages = 0;
    
    this.handlersByMessageType = obj.handlersByMessageType || new Map();
    let listeners = new Map();

    this.setPoolSize = function(size) {
      if (+size > 0 && +size < (maxPoolSize + 1)) {
        poolSize = +size;
      }
    }

    this.setOnStartupModule = function(obj) {
      // should be an object:  {module: '/path/to/module', arguments: {key1: value1, ...etc} }
      if (!onStartupModule) {
        obj = obj || {};
        onStartupModule = obj.module;
        onStartupArguments = obj.arguments;
      }
    }

    this.on = function(type, callback) {
      if (!listeners.has(type)) {
        listeners.set(type, callback);
      }
    };

    this.off = function(type) {
      if (listeners.has(type)) {
        listeners.delete(type);
      }
    };

    this.emit = function(type, data) {
      if (listeners.has(type)) {
        let handler =  listeners.get(type);
        handler.call(q, data);
      }
    }

    this.getQueueLength = function() {
      return queue.length;
    };

    let uuid = uuidv4();
    let workers = new Map();
    let isAvailable = new Map();
    let pendingRequests = new Map();
    let maxQLength = obj.maxQLength || 20000;
    let queue = new deq(maxQLength);
    let nextWorkerId = 0;
    let q = this;

    function processQueue() {
      q.log('try processing queue: length ' + queue.length);
      if (queue.isEmpty()) {
        q.log('Queue empty');
        return;
      }
      let worker = getWorker();
      if (worker) {
        q.log('worker ' + worker.id + ' was available. Sending message to it');
        sendMessageToWorker(worker);
      }
      else {
        // no workers were available
        // start a new one unless maximum pool size has been exceeded
        q.log('no available workers');
        if (workers.size < poolSize) {
          q.log('starting new worker');
          startWorker();
        }
      }
    }

    function getWorker() {
      for (const [id, worker] of workers) {
        worker.id = id;
        if (isAvailable.get(+worker.id)) return worker;
        //q.log('worker ' + id + ' is not available');
      }
      return false;
    }

    function sendMessageToWorker(worker) {
      if (queue.isEmpty()) return;
      let requestObj = queue.shift();
      let id = +worker.id;
      let pendingRecord = {
        messageNo: requestObj.qoper8.messageNo,
        request: requestObj,
        callback: requestObj.qoper8.callback
      };
      pendingRequests.set(id, pendingRecord);
      delete requestObj.qoper8.callback;
      delete requestObj.qoper8.messageNo;
      isAvailable.set(id, false);

      if (handlerTimeout) {
        let timer = setTimeout(function() {

          // return an error to the waiting request promise
          //  include the original request, so it can be re-queued if desired

          // terminate the Worker Thread as there's probably something wrong with it

          removeFromQBackup(id);

          if (pendingRequests.has(id)) {
            let pendingRecord = pendingRequests.get(id);
            let callback = pendingRecord.callback;
            let requestObj = pendingRecord.request;
            delete requestObj.qoper8;
            let res = {
              error: 'Worker Thread handler timeout exceeded',
              originalRequest: requestObj
            };
            if (callback) callback(res, id);
            pendingRequests.delete(id);
            handlerTimers.delete(id);
            // send shutdown signal to child process to ensure it
            // stops its timer

            sendMessage({
              type: 'qoper8_terminate'
            }, worker);

          }

        },handlerTimeout);
        handlerTimers.set(id, timer);
      } 

      sendMessage(requestObj, worker);
      q.emit('sentToWorker', {
        message: requestObj,
        workerId: id
      });
    }

    function sendMessage(msg, worker) {
      if (!msg.qoper8) msg.qoper8 = {};
      msg.qoper8.uuid = uuid;
      worker.postMessage(msg);
    }

    function addToQBackup(requestObj) {
      let messageNo = requestObj.qoper8.messageNo;
      let req = {...requestObj};
      delete req.qoper8;
      q.emit('QBackupAdd', {
        id: messageNo,
        requestObject: req
      });
      if (QBackup && typeof QBackup.add === 'function') {
        try {
          QBackup.add(messageNo, req);
        }
        catch(err) {
          q.log("Error executing QBackup add method");
          q.log(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        }
      }
    }

    function removeFromQBackup(workerId) {
      if (pendingRequests.has(workerId)) {
        let pendingRecord = pendingRequests.get(workerId);
        let originalMessageNo = pendingRecord.messageNo;
        q.emit('QBackupDelete', originalMessageNo);
        if (QBackup && typeof QBackup.delete === 'function') {
          try {
            QBackup.delete(originalMessageNo);
          }
          catch(err) {
            q.log("Error running QBackup delete function");
            q.log(JSON.stringify(err, Object.getOwnPropertyNames(err)));
          }
        }
      }
    }

    function startWorker() {
      let worker = new Worker(__dirname + '/QOper8Worker.mjs');

      worker.on("message", function(res) {

        let id = +worker.id;

        if (res.qoper8 && res.qoper8.init) {
          initialised = true;
        }

        let dispRes = {...res};
        //let dispRes = JSON.parse(JSON.stringify(res));
        delete dispRes.qoper8;

        q.emit('replyReceived', {
          reply: dispRes,
          workerId: id
        });

        q.log('response received from Worker: ' + id);
        q.log(JSON.stringify(dispRes, null, 2));

        if (pendingRequests.has(id)) {
          let pendingRecord = pendingRequests.get(id);
          let callback = pendingRecord.callback;
          if (callback) callback(res, id);
        }

        if (res.qoper8) {
          if (res.qoper8.finished) {
            q.emit('worker' + id + 'Available');
            q.emit('worker' + id + 'Response', res);
            clearTimeout(handlerTimers.get(id));

            removeFromQBackup(id);

            // If an error has been returned, stop the Worker Thread to
            //  prevent unwanted side effects

            if (res.error && res.shutdown) {
              workers.delete(id);
              isAvailable.delete(id);
              pendingRequests.delete(id);
              handlerTimers.delete(id)
              q.emit('worker' + id + 'Terminated');
              worker.terminate();
              if (!stopped) processQueue();
              return;
            }

            // get rid of the pending request as it's been successfully handled

            pendingRequests.delete(id);
            isAvailable.set(id, true);
            handlerTimers.delete(id)
            if (!stopped) processQueue();
          }
          else if (res.qoper8.shutdown) {
            q.log('QOper8 is shutting down Worker Thread ' + id);
            workers.delete(id);
            isAvailable.delete(id);
            pendingRequests.delete(id);
            handlerTimers.delete(id)
            q.emit('worker' + id + 'Terminated');
            worker.terminate();
          }
        }
      });

      worker.on('exit', function(exitCode) {
        // make sure any failed workers are removed from the worker, 
        //  available and other worker-related maps

        let id = +worker.id;
        q.log('Worker Thread ' + id + ' has stopped with exitCode ' + exitCode);
        workers.delete(id);
        isAvailable.delete(id);
        if (handlerTimers.has(id)) {
          let timer = handlerTimers.get(id)
          clearTimeout(timer);
          handlerTimers.delete(id);
        }

        removeFromQBackup(id);

        // if there's a promise waiting for a response, return an error
        //  and the original request, so user can decide whether or not to requeue
        //  the message

        // then shut down the worker

        if (pendingRequests.has(id)) {
          let pendingRecord = pendingRequests.get(id);
          let callback = pendingRecord.callback;
          let requestObj = pendingRecord.request;
          if (requestObj) {
            delete requestObj.qoper8;
            let res = {
              error: 'Worker Thread has shut down unexpectedly',
              originalRequest: requestObj
            };
            q.emit('threadExit', requestObj);
            callback(res, id);
          }
          pendingRequests.delete(id);
        }
        if (!stopped) processQueue();
      });

      worker.id = nextWorkerId++;
      let msg = {
        qoper8: {
          init: true,
          id: worker.id,
          handlersByMessageType: q.handlersByMessageType,
          workerInactivityCheckInterval: inactivityCheckInterval,
          workerInactivityLimit: inactivityLimit,
          logging: q.logging,
          onStartupModule: onStartupModule,
          onStartupArguments: onStartupArguments
        }
      };
      sendMessage(msg, worker);
      workers.set(worker.id, worker);
      q.emit('workerStarted', worker.id)
    }

    function addToQueue(obj) {
      if (stopped) {
        if (obj.qoper8 && obj.qoper8.callback) {
          obj.qoper8.callback({
            error: 'QOper8 has been stopped'
          });
        }
        return;
      }
      noOfMessages++;
      obj.qoper8.messageNo = noOfMessages;
      queue.push(obj);
      addToQBackup(obj);
      q.emit('addedToQueue', obj);
      processQueue();
    }

    this.message = function(obj, callback) {
      if (!obj.qoper8) obj.qoper8 = {};
      obj.qoper8.callback =  callback || false
      addToQueue(obj);
    }

    function isStopped(id) {
      return new Promise((resolve) => {
        q.on('worker' + id + 'Terminated', function() {
          q.off('worker' + id + 'Terminated');
          resolve();
        });
      });
    };

    function isNowAvailable(id) {
      return new Promise((resolve) => {
        q.on('worker' + id + 'Available', function() {
          q.off('worker' + id + 'Available');
          resolve();
        });
      });
    };

    function workerResponse(id) {
      return new Promise((resolve) => {
        q.on('worker' + id + 'Response', function(res) {
          q.off('worker' + id + 'Response');
          resolve(res);
        });
      });
    };

    this.stop = async function() {
      stopped = true;
      for (const [id, worker] of workers) {
        if (isAvailable.get(+id)) {
          q.log('Worker Thread ' + id + ' is being stopped');
          let msg = {type: 'qoper8_terminate'};
          sendMessage(msg, worker);
          await isStopped(id);
          q.log('Worker Thread ' + id + ' has been stopped (1)');
        }
        else {
          q.log('Waiting for Worker Thread ' + id + ' to become available');
          await isNowAvailable(id);
          let msg = {type: 'qoper8_terminate'};
          sendMessage(msg, worker);
          await isStopped(id);
          q.log('Worker Thread ' + id + ' has been stopped (2)');
        }
      }
      q.emit('stop');
      q.log('No Worker Threads are running: QOper8 is no longer handling messages');
      if (exitOnStop) process.exit();
    };

    this.start = function() {
      stopped = false;
      q.log('QOper8 will now handle messages');
      q.emit('start');
      processQueue();
    };

    this.upTime = function() {
      let sec = (new Date().getTime() - startedAt)/1000;
      let hrs = Math.floor(sec / 3600);
      sec %= 3600;
      let mins = Math.floor(sec / 60);
      if (mins < 10) mins = '0' + mins;
      sec = Math.floor(sec % 60);
      if (sec < 10) sec = '0' + sec;
      let days = Math.floor(hrs / 24);
      hrs %= 24;
      return days + ' days ' + hrs + ':' + mins + ':' + sec;
    }

    this.getStats = async function() {
      let mem = process.memoryUsage();
      let stats = {
        main_process: {
          pid: process.pid,
          upTime: this.upTime(),
          noOfMessages: noOfMessages,
          memory: {
            rss: (mem.rss /1024 /1024).toFixed(2), 
            heapTotal: (mem.heapTotal /1024 /1024).toFixed(2), 
            heapUsed: (mem.heapUsed /1024 /1024).toFixed(2)
          },
          queue_length: queue.length
        },
        worker_threads: {}
      };
      for (const [id, worker] of workers) {
        if (isAvailable.get(+id)) {
          let msg = {type: 'qoper8_getStats'};
          sendMessage(msg, worker);
          let res = await workerResponse(id);
          stats.worker_threads[id] = res;
        }
        else {
          q.log('Waiting for Worker Thread ' + id + ' to become available');
          await isNowAvailable(id);
          let msg = {type: 'qoper8_getStats'};
          sendMessage(msg, worker);
          let res = await workerResponse(id);
          stats.worker_threads[id] = res;
        }
      }
      return stats;
    }


    if (this.logging) {
      console.log('========================================================');
      console.log('qoper8-wt Build ' + this.build + '; ' + this.buildDate + ' running in process ' + process.pid);
      console.log('Max worker pool size: ' + poolSize);
      console.log('========================================================');
    }

    process.on( 'SIGINT', async function() {
      q.log('*** CTRL & C detected: shutting down gracefully...');
      await q.stop();
    });

    process.on( 'SIGTERM', async function() {
      q.log('*** Master Process ' + process.pid + ' detected SIGTERM signal.  Shutting down gracefully...');
      await q.stop();
    });

  }

  send(messageObj) {
    let q = this;
    return new Promise((resolve) => {
      q.message(messageObj, function(responseObj) {
        resolve(responseObj);
      });
    });
  }

  log(message) {
    if (this.logging) {
      console.log(Date.now() + ': ' + message);
    }
  }

}

export {QOper8};
