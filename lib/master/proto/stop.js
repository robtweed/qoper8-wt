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

function stop() {

  function stopMaster() {
    this.emit('stop');
    console.log('No worker processes are running');
    console.log('Master process will now shut down');
    if (this.exitOnStop) process.exit();
  }
  this.stopping = true;
  var cpList = this.getWorkerPids();
  var stillRunning = cpList.length;
  if (stillRunning === 0) {
    // no worker processes running - just shut down master process
    stopMaster.call(this);
    return;
  }

  // create exit handlers for each running worker process
  //  master will be shut down when all worker processes have fired
  //  their exit handler

  var q = this;
  var pids = {};
  cpList.forEach(function(pid) {
    pids[pid] = true;
    this.worker.process[pid].on('exit', function() {
      console.log('exit received from worker thread ' + pid);
      stillRunning--;
      delete pids[this.pid];
      if (stillRunning === 0) {
        // all worker processes have been shut down
        // safe to stop master process
        stopMaster.call(q);
      }
    });
  }, this);

  // remove timer
  //  thanks to Ward De Backer for improvements to worker pool checking logic
  clearInterval(this.checkWorkerPoolTimer);
  // clear down queue;
  this.queue.clear();
  // send signal to each worker to shut down
  var msg = {
    type: 'stopWorkerProcess',
    message: {
      pid: pid
    }
  };
  for (var pid in this.worker.process) {
    this.stopWorker(pid);
    msg.message.pid = pid;
    this.emit('workerFinished', msg, pid);
  }

  // if all else fails, this will eventually shut down the master process

  setTimeout(function() {
    console.log('*********************');
    console.log('Warning! The following worker processes did not shut down successfully:');
    for (var pid in pids) {
      console.log(pid);
    }
    console.log('*********************');
    console.log('The master process will now shut down anyway...');
    stopMaster.call(q);
  }, this.shutdownDelay);

};

module.exports = stop;
