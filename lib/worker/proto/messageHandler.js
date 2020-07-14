/*

 ----------------------------------------------------------------------------
 | qoper8-wt: Node.js Queue and Worker Thread Pool Management Utility       |
 |                                                                          |
 | Copyright (c) 2019-20 M/Gateway Developments Ltd,                        |
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

  14 July 2020

*/


function messageHandler(messageObj) {
  let _this = this;

  if (this.log) {
    if (messageObj.type && !this.suppressLog[messageObj.type]) {
      var now = new Date().toUTCString();
      console.log(now + '; worker thread ' + this.threadId + ' received message: ' + JSON.stringify(messageObj));
    }
  }
  this.count++;
  var type = messageObj.type;

  if (type === 'qoper8-start') {
    this.log = messageObj.log;
    this.build = messageObj.build;
    if (messageObj.userDefined) {
      this.userDefined = messageObj.userDefined;
    }
    if (this.userDefined && this.userDefined.config && this.userDefined.config.database) {
      // running in QEWD - don't flag started condition until database is connected
      this.on('dbOpened', function(status) {
        _this.hasStarted.call(_this);
      });
    }

    this.emit('start', messageObj.isFirst);
    if (!messageObj.userDefined) {
      // flag that it's started immediately
      this.hasStarted.call(this);
    }
    else {
      if (!this.userDefined.config) {
        // userDefined set up but not running in QEWD
        this.hasStarted.call(this);
      }
    }
    return;
  }

  if (type === 'qoper8-getStats') {
    this.parentPort.postMessage({
      type: 'qoper8-stats',
      stats: this.getStats(),
      id: messageObj.id,
      dontLog: true
    });
    return;
  }

  if (type === 'qoper8-exit') {
    // run any custom shutdown logic
    this.emit('stop');
    this.exit.call(this);
    return;
  }

  if (type === 'qoper8-test') {
    // handle test message
    if (this.log) console.log(type + ' message received by worker ' + process.pid + ': ' + JSON.stringify(messageObj));
    var responseObj = {
      responseNo: messageObj.messageNo,
      contents: messageObj.contents,
      count: this.count
    };
    this.hasFinished(type, responseObj);
    responseObj = null;
    return;
  }

  // handle any other incoming message using custom handler

  var worker = this;

  function send(results) {
    if (results.type) {
      var type = results.type;
      delete results.type;
      worker.returnMessage(type, results);
    }
    else {
      worker.returnMessage(messageObj.type, results);
    }
  }

  function finished(results) {
    if (worker.sessionLocked && worker.db) {
      var ok = worker.db.unlock(worker.sessionLocked);
    }
    worker.hasFinished.call(worker, messageObj.type, results);
  }

  var ok = this.emit('message', messageObj, send, finished);
  if (!ok) {
    var results = {
      error: 'No handler found for ' + type + ' message'
    };
    this.hasFinished.call(this, type, results);
  }
}

module.exports = messageHandler;
