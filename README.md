# qoper8-wt: Node.js Worker Thread Pool Management System

Rob Tweed <rtweed@mgateway.com>  
20 August 2019, M/Gateway Developments Ltd [http://www.mgateway.com](http://www.mgateway.com)  

Twitter: @rtweed

Google Group for discussions, support, advice etc: [http://groups.google.co.uk/group/enterprise-web-developer-community](http://groups.google.co.uk/group/enterprise-web-developer-community)

## What is qoper8-wt?

*qoper8-wt* is a generic, high-performance Node.js-based message queue and worker pool management
module, using Worker Threads.

It provides you with:

- a memory-based queue within your main process onto which you can add JSON messages
- a pool of persistent Worker Threads that run your message handler functions
- a Worker Thread pool manager that will start up and shut down Worker Threads based on demand
- a dispatcher that processes the queue whenever a message is added to it, and attempts to send the message to an available Worker Thread

It differs from most other Worker Thread pool management systems by preventing a Worker Thread
 from handling more than one message at a time.  This is by deliberate design to avoid the 
concurrency issues that are normally associated with Node.js

You determine the maximum size of the Worker Thread pool.  If no free Worker Threads in your
pool are available, messages will remain on the queue.  The queue is automatically processed whenever:

- a new message is added to the queue
- a Worker Thread completes its processing of a message and returns itself to the available pool

The structure of messages is entirely up to you, but:

- they are JavaScript objects, of any size and complexity
- they cannot contain functions
- they should always have a *type* property

How messages are processed within a Worker Thread is up to you.  
You define a handler method/function for each message *type* you expect to be added to the queue.

*qoper8-wt* is highly customisable.   For example, the Master process and/or Worker Threads can be 
customised to connect to any database you wish, and *qoper8-wt* can be integrated with a 
Node.js-based web-server module such as *Express*, and/or with a web-socket module such as *socket.io*.  


## Installing *qoper8-wt*

**NOTE:** *qoper8-wt* requires Node.js version 12 or later, because it uses the Worker Thread
functionality.


       npm install qoper8-wt



## Getting Started With qoper8-wt

*qoper8-wt* is pre-configured with a set of default methods that essentially invoke a "do nothing"ù
action. You can therefore very simply test *qoper8-wt* by writing and running the following script
file:

        var qoper8 = require('qoper8-wt');
        var q = new qoper8.masterProcess();
        console.log(q.version() + ' running in process ' + process.pid);
        q.start();



(You'll find a copy of this in the */examples* sub-folder within the *qoper8-wt* module folder.
Look for the file *test1.js*)

This example will start the *qoper8-wt* Master process, with a Worker Thread pool size of 1. It will
then sit waiting for messages to be added to the queue - which isn't going to happen in this script.
When *qoper8-wt* starts, it does not actually start any Worker Threads. A Worker Thread is only
started when:

- a message is added to the queue; AND
- no currently-running Worker Thread is available; AND
- the maximum Worker Thread pool size has not yet been reached

So if you run the above script you should just see something like this:

        pi@rpi4-0:~/qewd $ node examples/test1

        qoper8-wt Build 4.0.0; 20 August 2019 running in process 21488
        Worker Bootstrap Module file written to ./node_modules/qoper8-wt-worker.js
        ========================================================
        qoper8-wt is up and running.  Max worker pool size: 1
        ========================================================


Notice the second line of output: *qoper8-wt* always automatically creates a file 
containing the core Worker Thread logic from which it bootstraps itself. However, since the 
test script doesn't add any messages to qoper8-wt's queue, no worker processes are created 
and the Master Process will just sit waiting.

To stop qoper8-wt, just press CTRL & C within the process console, or send a SIGINT message
from another process, eg:

        kill 21488

Note: the number should be the process Id for the *qoper8-wt* Master Process.

In either case you should see something like the following:

        ^C*** CTRL & C detected: shutting down gracefully...
        No worker processes are running
        Master process will now shut down

Alternatively, if you leave the script running, it will time-out and shut itself down
automatically after 10 seconds, and you'll see:

        No worker processes are running
        Master process will now shut down

        pi@rpi4-0:~/qewd


## Try Adding a Message to the *qoper8-wt* Queue

You use *qoper8-wt*'s *addToQueue()* method to add messages to the Queue. 
Messages are simply JavaScript objects, but they **must** always have a *type* property defined. 
The value of the *type* property is entirely up to you. Defining a type assists in message and 
response handling. The built-in logging reports will assume your messages have a *type* property, 
and your handler methods for processing messages are invoked by matching them to the *type* property.

So we could do the following test (see *test2.js* in the */examples* sub-folder):


        var qoper8 = require('qoper8-wt');
        var q = new qoper8.masterProcess();

        q.on('started', function() {
          console.log(q.version() + ' running in process ' + process.pid);

          var messageObj = {
            type: 'testMessage1',
            hello: 'world'
          };
          this.addToQueue(messageObj);
        });

        q.start();

        setTimeout(function() {
          q.stop();
        }, 10000);



Note: Any *qoper8-wt* activity should be defined within its *started* event handler. 
In the example above you can see a message object being created and queued using *this.addToQueue()*
 within the *q.on('started')* handler.

Running the above script should produce output similar to the following:

        pi@rpi4-0:~/qewd $ node examples/test2
        Worker Bootstrap Module file written to ./node_modules/qoper8-wt-worker.js
        ========================================================
        qoper8-wt is up and running.  Max worker pool size: 1
        ========================================================
        qoper8-wt Build 4.0.0; 20 August 2019 running in process 21650
        no available workers
        sent qoper8-start message to worker thread 1
        loading Worker Thread Startup File
        workerData = [null]
        Tue, 20 Aug 2019 10:05:22 GMT; master process received response from worker thread 1: {"type":"workerThreadStarted","ok":1}
        new worker thread 1 started and ready so process queue again
        Tue, 20 Aug 2019 10:05:22 GMT; worker thread 1 received message: {"type":"testMessage1","hello":"world"}
        Tue, 20 Aug 2019 10:05:22 GMT; master process received response from worker thread 1: {"type":"testMessage1","finished":true,"message":{"error":"No handler found for testMessage1 message"}}
        Master process has finished processing response from worker thread 1 which is back in available pool
        signalling worker 1 to stop
        Tue, 20 Aug 2019 10:05:32 GMT; worker thread 1 received message: {"type":"qoper8-exit"}
        worker thread 1 will now shut down
        *** master received exit event from worker process 1
        exit received from worker thread 1
        No worker processes are running
        Master process will now shut down
        pi@rpi4-0:~/qewd $


Let's examine this output to understand what happened.

*qewd-wt* started up successfully:


        Worker Bootstrap Module file written to ./node_modules/qoper8-wt-worker.js
        ========================================================
        qoper8-wt is up and running.  Max worker pool size: 1
        ========================================================
        qoper8-wt Build 4.0.0; 20 August 2019 running in process 21650


The message was then created in the Master Process and added to the queue.  This caused the
Master Process to start a Worker Thread, because it saw that there were no available Worker
Threads already running and available.  The Worker Thread was initialised ready for use:


        no available workers
        sent qoper8-start message to worker thread 1
        loading Worker Thread Startup File
        workerData = [null]

and reported back to the Master Process to inform it that it was ready for use:

        Tue, 20 Aug 2019 10:05:22 GMT; master process received response from worker thread 1: {"type":"workerThreadStarted","ok":1}
        new worker thread 1 started and ready so process queue again


The Master Process then sent the queued message to the now-started Worker Thread:

        Tue, 20 Aug 2019 10:05:22 GMT; worker thread 1 received message: {"type":"testMessage1","hello":"world"}


We haven't defined any handler logic for any types of message, so an error was registered by the
Worker Thread, processing flagged as finished in the Worker Thread, and the error 
message object returned to the Master Process:

        Tue, 20 Aug 2019 10:05:22 GMT; master process received response from worker thread 1: {"type":"testMessage1","finished":true,"message":{"error":"No handler found for testMessage1 message"}}

The Master Process then returned the Worker Thread to the available pool, ready to handle another
message:


        Master process has finished processing response from worker thread 1 which is back in available pool

**NOTE:** On completion of processing a message, the Worker Thread that was assigned to handle it
is **NOT** shut down, but remains running and ready to handle another message without incurring
the not insignificant time needed to start up.  That startup time is incurred just once when the
Worker Thread is first started by the Master Process.


In our example script, no further messages were queued and after 10 seconds, the Master Process was told to stop *qoper8-wt*.
Before doing so, it sends a message to each running Worker Thread - this triggers and event that can be
used within the Worker Threads to cleanly shut down any resources, external connections etc.

Each Worker Thread reports its shutdown to the Master Process:


        signalling worker 1 to stop
        Tue, 20 Aug 2019 10:05:32 GMT; worker thread 1 received message: {"type":"qoper8-exit"}
        worker thread 1 will now shut down
        *** master received exit event from worker process 1
        exit received from worker thread 1


When all Worker Threads have shut down, the Master Process shuts itself down:

        No worker processes are running
        Master process will now shut down



## Handling Multiple Messages

So far we've only queued a single message. We'll now see what happens when multiple messages are added
 to the queue. 

The following example (see *test3.js* in the */examples* folder) will queue two messages as soon
as the Master Process has started.  However, the Worker Thread pool size will be the default of 1:

        var qoper8 = require('qoper8-wt');
        var q = new qoper8.masterProcess();

        q.on('started', function() {

          var messageObj = {
            type: 'testMessage1',
            hello: 'world'
          };
          this.addToQueue(messageObj);

          messageObj = {
            type: 'testMessage2',
            hello: 'rob'
          };
          this.addToQueue(messageObj);
        });

        q.start();

        setTimeout(function() {
          q.stop();
        }, 5000);



When you run this script, the console log will show the Master Process starting and the Worker
Thread being started as before, and then you'll see it handling the first queued message:

        Tue, 20 Aug 2019 10:31:12 GMT; worker thread 1 received message: {"type":"testMessage1","hello":"world"}
        Tue, 20 Aug 2019 10:31:12 GMT; master process received response from worker thread 1: {"type":"testMessage1","finished":true,"message":{"error":"No handler found for testMessage1 message"}}
        Master process has finished processing response from worker thread 1 which is back in available pool

As soon as the Worker Thread becomes available again, it is sent the next queued message by the
Master Process:

        Tue, 20 Aug 2019 10:31:12 GMT; worker thread 1 received message: {"type":"testMessage2","hello":"rob"}

and this also generates an error in the Worker Thread:

        Tue, 20 Aug 2019 10:31:12 GMT; master process received response from worker thread 1: {"type":"testMessage2","finished":true,"message":{"error":"No handler found for testMessage2 message"}}
        Master process has finished processing response from worker thread 1 which is back in available pool

The key, important thing to understand from this test script is that the Worker Thread is only handling
**one message at a time**.  Only when the Worker Thread tells the Master Process that it has finished
processing its message will the Master Process send it the next available queued message (if one exists).

This means that because the Worker Thread only processes one message at a time, its handler method has
exclusive access to that Worker Thread and therefore does not have to compete for the Worker Thread's
resources with any other processing logic.  The normal concurrency issues that Node.js developers
need to consider, such as avoiding CPU-intensive logic, no longer apply when using a *qoper8-wt*
Worker Thread.

Try adding more messages to the queue and see how *qoper8-wt* handles them.


## Increasing the Worker Thread Pool Size

The Worker Thread Pool Size is one of many things that can be customised using configuration
properties and methods.

The best place to customise the *qoper8-wt* configuration is within a *start*ùevent handler.

For example, you can specify a Worker Thread Pool Size of 2 in one of two ways.

Using a built-in method:

        q.on('start', function() {
          this.setWorkerPoolSize(2);
        });

or by setting the configuration property:

        q.on('start', function() {
          this.worker.poolSize = 2;
        });


If you modify the previous example to use 2 worker processes, you should see a quite different
result, particularly if you queue up a larger number of message. 

For example, take the following script (see *test4.js* in the */examples* folder) which will
set a Worker Thread Pool Size of 2 and then queue up 5 messages when the Master Process has
started:

        var qoper8 = require('qoper8-wt');
        var q = new qoper8.masterProcess();

        q.on('start', function() {
          this.setWorkerPoolSize(2);
        });

        q.on('started', function() {
          var noOfMessages = 5;
          var messageObj;
          for (var i = 0; i < noOfMessages; i++) {
            messageObj = {
              type: 'testMessage1',
              hello: 'world',
              no: i
            };
            this.addToQueue(messageObj);
          }
        });

        q.start();

        setTimeout(function() {
          q.stop();
        }, 10000);


We can also add the following so we can see how many messages were handled by each Worker Thread:

        setTimeout(function() {
          console.log('Messages handled by each Worker Thread:');
          for (threadId in q.worker.process) {
            console.log('Thread ' + threadId + ': ' + q.worker.process[threadId].totalRequests);
          }
        }, 5000);


Run this script and the log will look quite different to previously.  You'll see the first two messages
in the queue causing the startup of the two available Worker Threads:

        sent qoper8-start message to worker thread 1
        ...
        sent qoper8-start message to worker thread2
        ...
        loading Worker Thread Startup File
        loading Worker Thread Startup File
        ...
        Tue, 20 Aug 2019 11:18:56 GMT; master process received response from worker thread 1: {"type":"workerThreadStarted","ok":1}
        new worker thread 1 started and ready so process queue again
        ...
        Tue, 20 Aug 2019 11:18:56 GMT; master process received response from worker thread 2: {"type":"workerThreadStarted","ok":2}
        new worker thread2 started and ready so process queue again

and, as each Worker Thread signals the completion of its initialisation to the Master Process,
you'll then see the queued messages being sent to them.

If you try running the script repeatedly, you'll probably see differences in terms of how many
messages were handled by each Worker Thread, eg:


        Messages handled by each Worker Thread:
        Thread 1: 4
        Thread 2: 1

or, eg:


        Messages handled by each Worker Thread:
        Thread 1: 5
        Thread 2: 0

Once again, however, you'll see that each of the two Worker Threads only handles a single message
at a time, but this time the work of processing them is spread between the two available Worker Threads.



## Defining a Worker Thread Message Handler

In the examples above, the Worker Threads have been applying a default *message event handler*. 
That's what's generating the error output lines such as this:

        Tue, 20 Aug 2019 11:18:56 GMT; master process received response from worker thread 2: {"type":"testMessage1","finished":true,"message":{"error":"No handler found for testMessage1 message"}}


You customise the behaviour of each Worker Thread by creating a Worker Handler Module that 
*qoper8-wt* will load into each worker process when they are started.

Your module can define any of the following event handlers:
- **start**: this will be invoked whenever a Worker Thread starts, at the point just before it
becomes ready for use by the Master Process ready
- **stop**: this will be invoked just before a Worker Thread closes down
- **message**: this is invoked whenever a message is received by the Worker Thread. 
This is where you define your logic for handling all messages (with the exception of 
*qoper8-wt*'s own control messages)


### Example Worker Module

Here's a simple example of a worker module:


        module.exports = function() {

          this.on('start', function() {
            if (this.log) console.log('Worker process ' + this.threadId + ' starting...');
          });

          this.on('message', function(messageObj, send, finished) {
            var response = {
              hello: 'world'
            };
            finished(response);
          });

          this.on('stop', function() {
            if (this.log) console.log('Worker process ' + this.threadId + ' stopping...');
          });

        };


You should always adhere to the pattern shown above:

- create a function that is exported from the module
- the function should have no arguments
- within the function you can define any or all of the worker's event hander functions


### The *start* event handler

The *start* event handler is where you can do things such as connect to databases or 
load other modules that you'll need in each Worker Thread.

Within the handler's callback function, *this* provides you access to all the
*qoper8-wt* Worker methods and properties.

The *on('start')* event's callback function can take a single optional argument: *isFirst*

This argument will be true if this is the first time a Worker Thread has been started since 
*qoper8-wt* itself was started. This is useful in situations where you want to initialise data
 in a database when *qoper8-wt* is started, but before any subsequent activity occurs.


### The *stop* event handler

Your *stop* event handler is where you can do things such as cleanly disconnect from 
databases or tidy up other resources before the Worker Thread is terminated. 

Within the handler's callback function, *this* provides you access to all the
*qoper8-wt* Worker methods and properties.


### The *message* event handler

The *message* event handler is where you'll define how to process all incoming messages
 that you have added to the queue. How they are processed is entirely up to you.

Its callback function provides three argument:

- **messageObj**: the raw incoming message object, sent from the Master Process's queue.
- **send**: a function that allows you to send a message to the Master Process without returning the
worker back to the available pool
- **finished**: a function that allows you to send a message to the Master Process, and signalling to
the Master Process that you have finished using the Worker Thread. The worker will be returned 
back to the available pool

Within the handler's callback function, *this* provides you access to all the
*qoper8-wt* Worker methods and properties. What you do with the message within the Worker 
Thread is entirely up to you. Once you've finished processing the message, you send the 
results back to the Master Process by invoking the *finished()* method.

The *finished* function takes a single argument:

- **resultObj**: an object containing the results that are to be returned to the master process

On receipt of the message created by the `finished()` method, the Master Process will 
return the Worker Thread back to the available pool.

You can optionally send more than one message back to the master process during processing, 
prior to using the *finished()* method. To do this, use the *send()* method. This takes the same argument
as the *finished()* method, ie  *resultObj*. 

The difference between *send()* and *finished()* is that on receipt of the *send()* function's message, 
the Master Process does not return the Worker Thread back to the available pool.

By default, both the *send()* and *finished()* functions return to the Master Process a 
message whose type property is the same as that of the message being handled. You can optionally use
the *send()* function to return messages with a different type property to the master process. 
To do this, simply define a type property in the *resultObj* object argument. Note that you 
cannot override the type property of the *finished()* function's result object (even if you try to
do so by specifying a *type* property in the *resultObj* object).

Make sure that your *on('message')* handler logic always ends with an invocation of the *finished()*
 function, and only invoke it once - failure to do so will cause the Worker Thread to not be 
released back to the available pool.


## Configuring *qoper8-wt* To Use Your Worker Handler Module

You instruct *qoper8-wt* to load your Worker Handler Module by setting the property 
*this.worker.module* from within your script's *on('start')* method handler. 
The module you specify will be loaded (using *require()*) into each Worker Thred when the
Worker Thread is started.

For example, if you saved your module in *./node_modules/exampleModule.js*, then you instruct 
*qoper8-wt* to load it as follows, eg:


        q.on('start', function() {
          this.worker.module = 'exampleModule';
        });


If your module is saved elsewhere, specify the module path accordingly. For example if you 
look at the example script *test5.js* in the */examples* folder, you'll see that it specifies:


        q.on('start', function() {
          this.setWorkerPoolSize(2);
          this.worker.module = process.cwd() + '/examples/example-worker-module';
        });

You may need to modify the module path as appropriate for your Node.js environment.  If in
doubt, specify a full, hard-coded path, eg:

          this.worker.module = '/home/pi/qewd/examples/example-worker-module';

Once you've edited this path appropriately, try running the *test5.js* script to see the 
effect of this module on the messages returned to the Master Process.


## Handling the Results Object Returned from a Worker Thread

When a results object is returned from a Worker Thread, you'll normally want to
define how the Master Process should handle it. 

Thus far, we've been letting *qoper8-wt*'s default action to take place,
which is to simply report the returned result message to the console.

The basic mechanism for handling messages returned by Worker Threads is to define an 
*on('response')* handler in your main script, eg:


        q.on('response', function(responseObj, threadId) {
          console.log('Received from Worker Thread ' + threadId + ': ' + JSON.stringify(responseObj, null, 2));
        });


As you can see above, the *on('response')* handler callback function provides two arguments:
- **resultsObj**: the raw incoming results object, sent from the worker process.
- **pid**: the process Id of the worker that handled the original message and sent this response

How you handle each returned message and what you do with it is up to you. Within the 
*on('response')* handler's callback function, *this* provides access to all of the Master Process's
*qoper8-wt* properties and methods.

Note that your *on('response')* handler function method intercepts *all* messages returned by 
Worker Threads, including *qoper8-wt*'s own ones. You'll be able to distinguish them because their 
type will have *qoper8-* as a prefix.

For a worked example, take a look at *test6.js* in the */examples* folder:


        var qoper8 = require('qoper8-wt');
        var q = new qoper8.masterProcess();

        q.on('start', function() {
          this.setWorkerPoolSize(2);
          this.worker.module = process.cwd() + '/examples/test-workerModule1';
        });

        q.on('response', function(responseObj, threadId) {
          console.log('** Master Process received from Worker Thread ' + threadId + ': ' + JSON.stringify(responseObj, null, 2));
        });

        q.on('started', function() {
          var noOfMessages = 5;
          var messageObj;
          for (var i = 0; i < noOfMessages; i++) {
            messageObj = {
              type: 'testMessage1',
              hello: 'world'
            };
            this.addToQueue(messageObj);
          }
        });

        q.start();

        setTimeout(function() {
          console.log('Messages handled by each Worker Thread:');
          for (threadId in q.worker.process) {
            console.log('Thread ' + threadId + ': ' + q.worker.process[threadId].totalRequests);
          }
          q.getWorkerAvailability(function(available) {
            console.log('Worker availability: ' + JSON.stringify(available));
          });
        }, 5000);

        setTimeout(function() {
          q.stop();
        }, 10000);



## Simpler Message Handling with the *handleMessage()* Function

Although the *addMessage()* function and the *on('response')* event handler provide 
the basic mechanisms for handling messages within the *qoper8-wt* Master Process, 
you can combine their operation by using the *handleMessage()* function instead.  You'll
probably find this preferable and a much slicker approach.

The *handleMessage()* function has two arguments:

- **messageObj**: the message object to be added to the Master Process's queue
- **callback**: a callback function which provides a single argument: *responseObj*
 containing the response object that was sent by the Worker Thread that handled the message.

Note that the callback function will fire for messages sent from the Worker Thread using 
both its *send()* and *finished()* functions.

For a worked example, take a look at *test7.js* in the */examples* folder:


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

            // Using the handleMessage() function here:

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



Here's the *on('message')* handler in the Worker Handler Module for this example:


        this.on('message', function(messageObj, send, finished) {

          send({
            info: 'intermediate message',
            pid: process.pid
          });

          count++;
          var results = {
            count: count,
            time: new Date().toString()
          };
          finished(results);
        });


Notice the way this is sending messages using both the *send()* and *finished()* functions. 
You'll see in the console log that both are intercepted by the *handleMessage()* function's 
callback function.


## Benchmark Test

Included in the */examples folder is a script named *benchmark.js*.

This will generate a specified number of messages and add them to the queue in timed batches. 
The messages are round-tripped to your worker process(es).

The benchmark will measure how long it takes to process the complete set of messages and 
will provide statistics such as the rate per second and the number of messages handled by each 
Worker Thread.

Rather than creating an initial massive queue of messages, the benchmark allows you to 
generate small batches of messages that are added to the queue, with a delay between each batch.
By careful tuning of the benchmark's arguments, you can create a steady state where messages
are consumed by *qoper8-wt* as fast as they are added to the queue.

If you add batches of messages too quickly to the queue, you'll see the queue size
increasing.  If you add them too slowly, you'll see messages telling you that the queue has
been exhausted.

You should use trial and error to establish a steady state where you see only an initial number
of messages telling you that the queue is growing, followed by silence until the benchmark test
has completed.


To run the benchmark:

        node node_modules/qoper8-wt/lib/tests/benchmark [[worker thread pool size] [total no of messages] [no of messages/batch] [pause between each batch (ms)]


The default values, if not specified as command line parameters are:
- Worker Thread pool size: 1
- no of messages: 100,000
- messages per batch: 500
- pause between each batch: 51ms

If you find that the queue just keeps building up throughout a run, increase the 
pause between batches. This will allow *qoper8-wt* to consume more of the queued 
messages before a next batch is added.

Conversely, if you see lots of reports of the queue being exhausted during a run, 
decrease the pause between batches, until you are topping up the queue as fast as it is 
being consumed.

Try different Worker Thread Pool sizes to discover how this affects the speed with
which messages are consumed by *qoper8-wt*.

Here's some examples of how to run the benchmark:


        node node_modules/ewd-qoper8/lib/tests/benchmark

This uses:
- Worker Thread pool size: 1
- no of messages: 100,000
- messages per batch: 500
- pause between each batch: 51ms


        node node_modules/ewd-qoper8/lib/tests/benchmark 2

This uses

- Worker Thread pool size: 2
- no of messages: 100,000
- messages per batch: 500
- pause between each batch: 51ms


        node node_modules/ewd-qoper8/lib/tests/benchmark 1 10000


This uses:
- Worker Thread pool size: 1
- no of messages: 10,000
- messages per batch: 500
- pause between each batch: 51ms


        node node_modules/ewd-qoper8/lib/tests/benchmark 2 5000 100


This uses:
- Worker Thread pool size: 2
- no of messages: 5,000
- messages per batch: 100
- pause between each batch: 51ms


        node node_modules/ewd-qoper8/lib/tests/benchmark 6 100000 1000 102


This uses:
- Worker Thread pool size: 6
- no of messages: 1,000,000
- messages per batch: 1000
- pause between each batch: 102ms



Here are maximum steady-state examples using a Raspberry Pi 4 (4Mb RAM):

### Worker Thread Pool Size: 1

        node benchmark 1 100000 500 52

Throughput: 9,472 messages/sec



### Worker Thread Pool Size: 2

        node benchmark 2 100000 500 26

Throughput: 18,698 messages/sec



### Worker Thread Pool Size: 3

        node benchmark 3 100000 500 25

Throughput: 19,113 messages/sec

 
### Worker Thread Pool Size: 4

        node benchmark 4 1000000 1000 46

Throughput: 20,681 messages/sec


### Worker Thread Pool Size: 5

        node benchmark 5 1000000 2000 92

Throughput: 20,802 messages/sec


### Worker Thread Pool Size: 6

        node benchmark 6 1000000 2000 91

Throughput: 20,919 messages/sec


### Worker Thread Pool Size: 7

        node benchmark 7 1000000 2000 90

Throughput: 21,103 messages/sec


### Worker Thread Pool Size: 8

        node benchmark 8 1000000 2000 89

Throughput: 21,218 messages/sec


### Worker Thread Pool Size: 9

        node benchmark 9 1000000 2000 90

Throughput: 21,085 messages/sec


### Worker Thread Pool Size: 10

        node benchmark 10 1000000 2000 91

Throughput: 20,694 messages/sec


So you can see that on a Raspberry Pi 4 (which has 4 CPU cores), maximum throughput
was achieved with 8 Worker Threads.


## License

 Copyright (c) 2019 M/Gateway Developments Ltd,                           
 Redhill, Surrey UK.                                                      
 All rights reserved.                                                     
                                                                           
  http://www.mgateway.com                                                  
  Email: rtweed@mgateway.com                                               
                                                                           
                                                                           
  Licensed under the Apache License, Version 2.0 (the "License");          
  you may not use this file except in compliance with the License.         
  You may obtain a copy of the License at                                  
                                                                           
      http://www.apache.org/licenses/LICENSE-2.0                           
                                                                           
  Unless required by applicable law or agreed to in writing, software      
  distributed under the License is distributed on an "AS IS" BASIS,        
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
  See the License for the specific language governing permissions and      
   limitations under the License.      
