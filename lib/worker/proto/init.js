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

  21 August 2019

*/

const { Worker, isMainThread, parentPort, threadId, workerData } = require('worker_threads');

var fs = require('fs');
var messageHandler = require('./messageHandler');

function init() {

  var workerListeners;

  console.log('workerData = ' + JSON.stringify(workerData));

  //if (process.argv[2] && process.argv[2] !== 'undefined') {
  if (workerData && Array.isArray(workerData) && workerData[0]) {
    var workerModule = workerData[0];
    var subModule;
    console.log('process.argv[2] = ' + workerModule);
    if (workerModule.indexOf('.') !== -1) {
      var pieces = workerModule.split('.');
      workerModule = pieces[0];
      subModule = pieces[1];
    }
    if (subModule) {
      if (workerModule !== '') {
        workerListeners = require(workerModule)[subModule];
      }
      else {
        workerListeners = require(workerData[0]);
      }
    }
    else {
      workerListeners = require(workerModule);
    }
    workerListeners.call(this);
  }

  this.on('unknownMessage', function(messageObj, send, finished) {
    var results = {
      error: 'No handler found for ' + messageObj.type + ' message'
    };
    finished(results);
  });

  var worker = this;
  worker.parentPort = parentPort;
  worker.threadId = threadId;

  parentPort.on('message', function(messageObj) {
    messageHandler.call(worker, messageObj);
  });

  process.on( 'SIGINT', function() {
    console.log('Child Process ' + process.pid + ' detected SIGINT (Ctrl-C) - ignored');
  });

  process.on( 'SIGTERM', function() {
    console.log('Child Process ' + process.pid + ' detected SIGTERM signal - ignored');
  });

  process.on('uncaughtException', function(err) {
    if (worker.userDefined && worker.userDefined.config && worker.userDefined.config.errorLogFile) {
      fs.appendFileSync(worker.userDefined.config.errorLogFile, '*** uncaughtException in worker ' + process.pid + ' at ' + (new Date()).toUTCString() + '\n' + err.stack + '\n\n');
    }
    console.error('*** uncaughtException in Worker Thread ' + worker.threadId + ' at ' + (new Date()).toUTCString());
    console.error(err.stack);
    worker.emit('unexpectedError');
    worker.hasFinished('error', err.message);
    console.error('*** Worker Thread ' + worker.threadId + ' is shutting down now ...');
    process.exit();
  });

  this.startTime = new Date().getTime();
  this.suppressLog = {
    'qoper8-getStats': true
  };
  this.dontLog = function(types) {
    var q = this;
    types.forEach(function(type) {
      q.suppressLog[type] = true;
    });
  };

};

module.exports = init;
