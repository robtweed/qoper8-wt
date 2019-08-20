/*

 ----------------------------------------------------------------------------
 | qoper8-wt: Node.js Queue and Worker Thread Pool Management Utility       |
 |                                                                          |
 | Copyright (c) 2019 M/Gateway Developments Ltd,                           |
 | Redhill, Surrey UK.                                                      |
 | All rights reserved.                                                     |
 |                                                                          |
 | http://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                               |
 |                                                                          |
 |                                                                          |
 | Licensed under the Apache License, Version 2.0 (the "License");          |
 | you may not use this file except in compliance with the License.         |
 | You may obtain a copy of the License at                                  |
 |                                                                          |
 |     http://www.apache.org/licenses/LICENSE-2.0                           |
 |                                                                          |
 | Unless required by applicable law or agreed to in writing, software      |
 | distributed under the License is distributed on an "AS IS" BASIS,        |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 | See the License for the specific language governing permissions and      |
 |  limitations under the License.                                          |
 ----------------------------------------------------------------------------

  20 August 2019

*/

const { Worker, isMainThread, parentPort, threadId } = require('worker_threads');

function startWorker(customQueue) {
  /*
  if (params && params.debug) {
    params.debug.worker_port++;
    process.execArgv.push('--debug=' + params.debug.worker_port);
  }
  */
  var args = [
    this.worker.module
  ];

  var q = this;

  // Ward DeBacker:
  // begin change for --inspect debugging

  var execArgv = process.execArgv.map(function (option, index) {
    if (option.indexOf('--inspect') !== -1) {
      q.worker.inspectPort++;;
      return '--inspect=' + q.worker.inspectPort;
    }
    else if ((option.indexOf('--debug') !== -1) && (option.indexOf('--debug-brk') === -1)) {
      q.worker.debugPort++;
      return '--debug=' + q.worker.debugPort;
    }
    else {
      return option;
    }
  });

  var options = {
    execArgv: execArgv,
    env: process.env,
    workerData: args
  };

  //console.log('this.worker: ' + JSON.stringify(this.worker, null, 2));

  var workerThread = new Worker(this.worker.loaderFilePath, options);

  // end change for --inspect debugging

  workerThread.on('message', function(responseObj) {
    if (q.log && !responseObj.dontLog) {
      var now = new Date().toUTCString();
      console.log(now + '; master process received response from worker thread ' + threadId + ': ' + JSON.stringify(responseObj));
    }
    delete responseObj.dontLog;
    var worker = q.worker.process[threadId];
    if (!worker) return;
    if (responseObj.type === 'workerThreadStarted') {
      q.worker.available.push(threadId);
      worker.isAvailable = true;
      worker.time = new Date().getTime();
      worker.totalRequests = 0;
      q.emit('workerStarted', responseObj.ok, customQueue);
      return;
    }
    var finished = (responseObj.finished === true);
    responseObj.threadId = workerThread.threadId;
    q.emit('response', responseObj, workerThread.threadId);

    if (!customQueue && finished) {
      if (q.log) console.log('Master process has finished processing response from worker thread ' + workerThread.threadId + ' which is back in available pool');
      // this check for worker is needed as custom onResponse may have stopped it
      if (worker) {
        q.worker.available.push(threadId);
        worker.isAvailable = q.worker.available.length;
        worker.time = new Date().getTime();
      }
      // now that this worker is available, process the queue again
      if (q.queue.length > 0) {
        q.processQueue(customQueue);
      }     
    }
  });

  workerThread.on('exit', function() {
    console.log('*** master received exit event from Worker Thread ' + threadId);
    var index = q.worker.process[threadId];
    q.worker.available.splice(index, 1);
    delete q.worker.process[threadId];
    // rebuild array of current worker process pids
    q.worker.list = [];
    for (var pid in q.worker.process) {
      q.worker.list.push(pid);
    }
  });

  workerThread.isAvailable = false;

  // Now that worker has started, fire off handshake message
  // and send it any custom initialisation / environment logic

  // this.userDefined is optional and allows custom user-defined information to be conveyed to the worker

  workerThread.postMessage({
    type: 'qoper8-start',
    log: this.log,
    isFirst: !this.started,
    build: this.build,
    userDefined: this.userDefined
  });
  if (this.log) console.log('sent qoper8-start message to Worker Thread ' + workerThread.threadId);
  this.started = true;
  // finally add worker process object to worker process array
  this.worker.process[workerThread.threadId] = workerThread;
  // rebuild array of current worker process pids
  this.worker.list = [];
  for (var threadId in this.worker.process) {
    this.worker.list.push(threadId);
  }
};

module.exports = startWorker;
