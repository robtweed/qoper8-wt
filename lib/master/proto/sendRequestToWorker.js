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

function sendRequestToWorker(pid) {

  if (this.queue.isEmpty()) return;

  var requestObj = this.queue.shift();

  // trigger any pre-dispatch processing

  this.emit('beforeDispatch', requestObj, pid);

  // now dispatch the request to the assigned worker

  try {
    this.worker.process[pid].postMessage(requestObj);
  }
  catch(err) {
    if (this.log) console.log('sendRequestToWorker error: unable to send to worker ' + pid);
    // something wrong with worker - put the request back on the queue and try again
    this.addToQueue(requestObj);
  }
  requestObj = null;
};

module.exports = sendRequestToWorker;
