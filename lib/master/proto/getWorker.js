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

function getWorker() {

  // try to find a worker process, otherwise return false

  var worker;
  let _this = this;

  function getAvailableWorker() {
    var threadId = _this.worker.available.shift();
    //console.log('*** thread to handle message: ' + threadId);
    if (threadId) {
      worker = _this.worker.process[threadId];
      if (!worker) {
        console.log(threadId + ' no longer exists');
        return getAvailableWorker();
      }
      worker.isAvailable = false;
      worker.time = new Date().getTime();
      worker.totalRequests++;
      return {
        threadId: threadId
      };
    }
    // no available threads

    worker = null;
    return {
      threadId: false,
      count: _this.worker.list.length
    };
  }

  return getAvailableWorker();

};

module.exports = getWorker;
