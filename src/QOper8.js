/*
 ----------------------------------------------------------------------------
 | QOper8-wt: Queue-based Node.js Worker Thread Pool Manager                 |
 |                                                                           |
 | Copyright (c) 2022 M/Gateway Developments Ltd,                            |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | http://www.mgateway.com                                                   |
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

22 August 2022

 */

// QOper8-wt Worker Thread Code

let workerCode = `

const { parentPort, threadId } = require("worker_threads");

let QWorker = class {
  constructor() {
    let logging = false;
    let listeners = new Map();
    let handlers = new Map();
    let startedAt = Date.now();
    let id = false;
    let initialised = false;
    let isActive = false;
    let toBeTerminated = false;
    let uuid = false;
    let delay = 60000;
    let inactivityLimit = 180000;
    let handlersByMessageType = new Map();
    let timer = false;
    let lastActivityAt = Date.now();
    let noOfMessages = 0;
    let q = this;

    let shutdown = function() {
      // signal to master process that I'm to be shut down
      q.log('Worker ' + id + ' sending request to shut down');
      let obj = {
        qoper8: {
          shutdown: true
        }
      };
      clearInterval(QOper8Worker.timer);
      parentPort.postMessage(obj);
      q.emit('shutdown_signal_sent');
    }

    let finished = function(res) {
      res = res || {};
      if (!res.qoper8) res.qoper8 = {};
      res.qoper8.finished = true;
      parentPort.postMessage(res);
      q.emit('finished', res);
      isActive = false;
      if (toBeTerminated) {
        shutdown();
      }
    }

    // make postMessage available to handlers (for optional intermediate messages to main process)
    this.postMessage = function(msg) {
      parentPort.postMessage(msg);
    };


    let startTimer = function() {
      timer = setInterval(function() {
        let inactiveFor = Date.now() - lastActivityAt;
        q.log('Worker ' + id + ' inactive for ' + inactiveFor);
        q.log('Inactivity limit: ' + inactivityLimit);
        if (inactiveFor > inactivityLimit) {
          if (isActive) {
            // flag to be terminated when activity finished
            q.log('Worker ' + id + ' flagged for termination');
            toBeTerminated = true;
          }
          else {
            shutdown();
          }
        }
      }, delay);
    }

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

    this.getMessageCount = function() {
      return noOfMessages;
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
    };

    this.log = function(message) {
      if (logging) {
        console.log(Date.now() + ': ' + message);
      }
    };

    this.onMessage = async function(obj) {

      lastActivityAt = Date.now();
      isActive = true;

      let error;

      if (obj.qoper8 && obj.qoper8.init && typeof obj.qoper8.id !== 'undefined') {
        if (initialised) {
          error = 'QOper8 Worker ' + id + ' has already been initialised';
          q.emit('error', error);
          return finished({
            error: error,
            originalMessage: obj
          });
        }

        id = obj.qoper8.id;
        uuid = obj.qoper8.uuid;
        if (obj.qoper8.workerInactivityCheckInterval) delay = obj.qoper8.workerInactivityCheckInterval; 
        if (obj.qoper8.workerInactivityLimit) inactivityLimit = obj.qoper8.workerInactivityLimit; 
        if (obj.qoper8.handlersByMessageType) {
          handlersByMessageType = obj.qoper8.handlersByMessageType;
        }
        logging = obj.qoper8.logging;
        startTimer();
        q.log('new worker ' + id + ' started...');
        q.emit('started', {id: id});
        initialised = true;
        return finished({
          threadId: threadId,
          qoper8: {
            init: true
          }
        });
      }

      // all subsequent messages

      if (!initialised) {
        error = 'QOper8 Worker ' + id + ' has not been initialised';
        q.emit('error', error);
        return finished({
          error: error,
          originalMessage: obj
        });
      }

      if (!obj.qoper8 || !obj.qoper8.uuid) {
        error = 'Invalid message sent to QOper8 Worker ' + id;
        q.emit('error', error);
        return finished({
          error: error,
          originalMessage: obj
        });
      }

      if (obj.qoper8.uuid !== uuid) {
        error = 'Invalid UUID on message sent to QOper8 Worker ' + id;
        q.emit('error', error);
        return finished({
          error: error,
          originalMessage: obj
        });
      }

      let dispObj = {...obj};
      //let dispObj = JSON.parse(JSON.stringify(obj));
      delete obj.qoper8.uuid;
      delete dispObj.qoper8;
      q.log('Message received by worker ' + id + ': ' + JSON.stringify(dispObj, null, 2));
      q.emit('received', {message: dispObj});

      if (obj.type === 'qoper8_terminate') {
        shutdown();
        return;
      }

      if (obj.type === 'qoper8_getStats') {
        return finished(q.getStats());
      }

      if (!obj.type && !obj.handlerUrl) {
        error = 'No type or handler specified in message sent to worker ' + id;
        q.emit('error', error);
        return finished({
          error: error,
          originalMessage: dispObj
        });
      }

      if (obj.type && handlersByMessageType.has(obj.type)) {
        if (!handlers.has(obj.type)) {
          let handlerObj = handlersByMessageType.get(obj.type);
          if (handlerObj.text) {
            let handlerFn = new Function('message', 'finished', handlerObj.text);
            handlers.set(obj.type, handlerFn);
          }
          else if (handlerObj.module) {
            try {
              let {handler} = await import(handlerObj.module);
              handlers.set(obj.type, handler);
            }
            catch(err) {
              error = 'Unable to load Handler module ' + handlerObj.module;
              q.log(error);
              q.log(JSON.stringify(err, Object.getOwnPropertyNames(err)));
              q.emit('error', {
                error: error,
                caughtError: JSON.stringify(err, Object.getOwnPropertyNames(err))
              });
              return finished({
                error: error,
                caughtError: JSON.stringify(err, Object.getOwnPropertyNames(err)),
                originalMessage: dispObj,
                workerId: id
              });
            }
          }
          q.emit('handler' + obj.type + 'Loaded');

        }
        noOfMessages++;
        let handler = handlers.get(obj.type);
        try {
          let ctx = {...q};
          ctx.id = id;
          handler.call(ctx, obj, finished);
        }
        catch(err) {
          error = 'Error running Handler Method for type ' + obj.type;
          q.log(error);
          q.log(err);
          q.emit('error', {
            error: error,
            caughtError: JSON.stringify(err, Object.getOwnPropertyNames(err))
          });
          // shutdown the Worker Thread to prevent any unwanted side-effects
          return finished({
            error: error,
            caughtError: JSON.stringify(err, Object.getOwnPropertyNames(err)),
            originalMessage: dispObj,
            workerId: id
          });
        }
      }
      else {
        error = 'No handler defined for messages of type ' + obj.type;
        q.log(error);
        q.emit('error', error);
        return finished({
          error: error,
          originalMessage: dispObj
        });
      }
    };
  }

  getStats() {
    let mem = process.memoryUsage();
    return {
      threadId: threadId,
      uptime: this.upTime(),
      noOfMessages: this.getMessageCount(),
      memory: {
        rss: (mem.rss /1024 /1024).toFixed(2), 
        heapTotal: (mem.heapTotal /1024 /1024).toFixed(2), 
        heapUsed: (mem.heapUsed /1024 /1024).toFixed(2)
      }
    };
  }
};

let QOper8Worker = new QWorker();


parentPort.on('message', async function(messageObj) {
  await QOper8Worker.onMessage(messageObj);
});


`;

// ******* QOper8 Main Process *****************

import {Worker, workerData, threadId} from 'node:worker_threads';
import deq from 'double-ended-queue';
import { v4 as uuidv4 } from 'uuid';

let initialised = false;

class QOper8 {
  constructor(obj) {

    obj = obj || {};

    if (obj.workerInactivityCheckInterval) obj.workerInactivityCheckInterval = obj.workerInactivityCheckInterval * 1000;
    if (obj.workerInactivityLimit) obj.workerInactivityLimit = obj.workerInactivityLimit * 60000;

    this.name = 'QOper8-wt';
    this.build = '5.0';
    this.buildDate = '16 August 2022';
    this.logging = obj.logging || false;
    let poolSize = +obj.poolSize || 1;
    let maxPoolSize = obj.maxPoolSize || 32;
    if (poolSize > maxPoolSize) poolSize = maxPoolSize;
    let inactivityCheckInterval = obj.workerInactivityCheckInterval || 60000;
    let inactivityLimit = obj.workerInactivityLimit || (20 * 60000);

    let handlerTimeout = obj.handlerTimeout || false;
    let handlerTimers = new Map();

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
            handleTimers.delete(id);
            setTimeout(function() {
              worker.terminate();
            }, 1000);
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
      if (QBackup && typeof QBackup.add === 'function') {
        let messageNo = requestObj.qoper8.messageNo;
        try {
          QBackup.add(messageNo, requestObj);
        }
        catch(err) {
          q.log("Error executing QBackup add method");
          q.log(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        }
      }
    }

    function removeFromQBackup(workerId) {
      if (QBackup && typeof QBackup.delete === 'function') {
        let pendingRecord = pendingRequests.get(workerId);
        if (pendingRecord) {
          let originalMessageNo = pendingRecord.messageNo;
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
      let worker = new Worker(workerCode, {eval: true});

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

            if (res.error) {
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
        processQueue();
      });

      worker.id = nextWorkerId++;
      let msg = {
        qoper8: {
          init: true,
          id: worker.id,
          handlersByMessageType: q.handlersByMessageType,
          workerInactivityCheckInterval: inactivityCheckInterval,
          workerInactivityLimit: inactivityLimit,
          logging: q.logging
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
