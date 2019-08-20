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

var qoper8 = require('qoper8-wt');
var q = new qoper8.masterProcess();

q.on('start', function() {
  this.toggleLogging();
  this.worker.poolSize = 1;
  this.worker.module = process.cwd() + '/examples/test-workerModule2';
});

q.on('stop', function() {
  console.log('Test 7 Completed')
});

q.on('started', function() {
  var noOfMessages = 5;
  var messageObj;
  for (let i = 0; i < noOfMessages; i++) {
    messageObj = {
      type: 'testMessage1',
      hello: 'world'
    };
    this.handleMessage(messageObj, function(response) {
      console.log('** Master Processes received message: ' + i + ': ' + JSON.stringify(response, null, 2));
    });
  }
});

q.start();

setTimeout(function() {
  console.log('Messages handled by each Worker Thread:');
  for (threadId in q.worker.process) {
    console.log('Thread ' + threadId + ': ' + q.worker.process[threadId].totalRequests);
  }
  q.stop();
}, 10000);

