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

var fs = require('fs');

function createWorkerProcessModule() {
  var text = '';
  var workerFile = this.worker.loaderText;
  var fileLength = workerFile.length;
  for (var i = 0; i < fileLength; i++) {
    text = text + workerFile[i] + '\n';
  }
  fs.writeFileSync(this.worker.loaderFilePath, text);
  if (this.log) console.log('Worker Bootstrap Module file written to ' + this.worker.loaderFilePath);
  delete this.worker.loaderText;
};

module.exports = createWorkerProcessModule;  