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

  9 July 2020

*/

function stopWorker(pid) {

  let _this = this;

  function fn(responseObj, threadId) {
    if (responseObj.type === 'stopWorkerProcess' && responseObj.message && responseObj.message.pid === pid) {
      console.log('ready to safely shutdown thread ' + pid);
      _this.off('workerFinished', fn);
      let index = _this.worker.available.indexOf(pid);
      _this.worker.available.splice(index, 1);
      index = _this.worker.list.indexOf(pid);
      _this.worker.list.splice(index, 1);
      _this.worker.process[pid].isAvailable = false;
      _this.worker.process[pid].postMessage({
        type: 'qoper8-exit'
      });
      delete _this.worker.process[pid];
    }
  }

  this.on('workerFinished', fn);

};

module.exports = stopWorker;
