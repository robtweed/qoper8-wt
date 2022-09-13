# QOper8-wt: Queue-based Node.js Worker Thread Pool Manager
 
Rob Tweed <rtweed@mgateway.com>  
16 August 2022, M/Gateway Developments Ltd [http://www.mgateway.com](http://www.mgateway.com)  

Twitter: @rtweed

Google Group for discussions, support, advice etc: [http://groups.google.co.uk/group/enterprise-web-developer-community](http://groups.google.co.uk/group/enterprise-web-developer-community)


## What is QOper8-wt?

*QOper8-wt* is a Node.js/JavaScript Module that provides a simple yet powerful way to use and manage Worker Threads in your
Node.js applications.

*QOper8-wt* allows you to define a pool of Worker Threads, to which messages that you create are automatically
dispatched and handled.  *QOper8-wt* manages the Worker Thread pool for you automatically, bringing them into play and closing them down based on demand.  *QOper8-wt* allows you to determine how long a Worker Thread process will persist.

*Qoper8-wt* makes use of the standard Node.js Worker Thread APIs, and uses its standard *postMessage()* API for communication between the main QOper8 process and each Worker Thread.  No other networking APIs or technologies are involved, and no external network traffic is conducted within QOper8's logic.

*Note*: The *QOper8-wt* module closely follows the pattern and APIs of the browser-based 
[*QOper8-ww*](https://github.com/robtweed/QOper8) module for WebWorker pool management. 


*QOper8-wt* is unique for several reasons:

- it works on a queue/dispatch architecture.  All you do as a developer is use a simple API to add a message to the *QOper8-wt* queue.  You then let *QOper8-wt* do the rest.

- each Worker Thread process only handles a single message request at a time.  There are therefore no concurrency issues to worry about within your Worker Thread handler method(s)

- messages contain a JSON payload and a type which you specify.  You can have and use as many types as you wish, but you must create a handler method for each message type.  *QOper8-wt* will load your message type handler methods dynamically and automatically into the Worker Thread that it allocates to handle the message.

*QOper8-wt* will automatically shut down Worker Threads if they have been inactive for a pre-defined length of time (20 minutes by default).


## Node.js Version Compatibility

*QOper8-wt* is designed for use with Node.js version 18 and later.


## Installing

        npm install QOper8-wt

Then you can import the *QOper8* class:

        import {QOper8} from 'QOper8-wt';


## Starting/Configuring *QOper8-wt*

You start and configure *QOper8-wt* by creating an instance of the *QOper8* class:

      let qoper8 = new QOper8(options);

*options* is an object that defines your particular configuration.  Its main properties are:

- *poolSize*: the maximum number of Worker Thread processes that *QOper8-wt* will start and run concurrently (Note that Worker Threads are started dynamically on demand.  If not specified, the poolSize will be 1: ie all messages will be handled by a single Worker Thread

- *maxPoolSize*: It is possible to modify the poolSize of a running *QOper8-wt* system (see later), but you may want to set a cap on what is possible.  This *maxPoolSize* option allows you to do this.  If not specified, a value of 32 is used.

- *handlersByMessageType*: a JavaScript Map of each message type to its respective handler method module URL.  Message types can be any string value.  See later on how to use this Map.

- *maxQueueLength*: in order to maximise performance, *QOper8-wt* makes use of a module that is specially designed for high-performance queues: [*double-ended-queue*](https://www.npmjs.com/package/double-ended-queue).  This needs to be initialised by specifying its maximum size.  If not specified, *QOper8-wt* will use a default value of 20,000, but you may want to reduce this if your expected activity allows, to further optimise performance.

- *logging*: if set to *true*, *QOper8-wt* will generate console.log messages for each of its critical processing steps within both the main process and every Worker Thread process.  This is useful for debugging during development.  If not specified, it is set to *false*.

- *exitOnStop*: if set to *true* and if you invoke the *stop()* API (see later), QOper8-wt will invoke a *process.exit()* command.  By default, QOper8 will remain running even when stopped (although it will deactivate its queue when stopped).

- *handlerTimeout*: Optional property allowing you to specify the length of time (in milliseconds) that the QOper8 main process will wait for a response from a Worker Thread.  If a *handlerTimeout* is specified and it is exceeded (eg due to a handler method going wrong), then an error is returned and the Worker Thread is shut down.  See later for details.

- *QBackup*: optional object that includes two functions for maintaining a backup queue (eg in a Redis key/value store), for critical systems where the resilience of the queue needs to be assured in the event of the main Node.js process crashing.  See later for details.


You can optionally modify the parameters used by *QOper8-wt* for monitoring and shutting down inactive Worker Thread processes, by using the following *options* properties:

- *workerInactivityCheckInterval*: how frequently (in seconds) a Worker Thread checks itself for inactivity.  If not specified, a value of 60 (seconds) is used

- *workerInactivityLimit*: the length of time (in minutes) a Worker Thread process can remain inactive until *QOper8-wt* shuts it down.  If not specified, the maximum inactivity duration is 20 minutes.


For example:

      let qoper8 = new QOper8({
        poolSize: 2,
        logging: true,
        handlersByMessageType: new Map([
         ['test', {module: './testHandler.mjs'}]
        ]),
        workerInactivityCheckInterval: 20,
        workerInactivityLimit: 5
      });


## Adding a Message to the *QOper8-wt* Queue

The simplest technique is to use the *send* API.  This method creates a Promise, the resolution of which will be the response object returned from the assigned Worker Thread that handled the message.

For example, you can use async/await syntax:

      let res = await qoper8.send(messageObject);

  where:

  - *messageObject*: an object with the following properties:

    - *type*: mandatory property specifying the message type.  The *type* value is a string that you determine, and must have a corresponding mapping in the *options.handlersByMessageType* Map that you used when configuring *QOper8-wt* (see above)

    - *data*: a sub-object containing your message payload.  The message payload content and structure is up to you.  Your associated message type handler method will, of course, be designed by you to expect and process this payload structure


  - *res*: the response object returned from the Worker Thread process that handled the message.  The structure and contents of the *res* object will be determined by you within your message type handler module.

eg:

      let res = await qoper8.send({
        type: 'myMessageType1',
        data: {
          hello: 'world'
        }
      });


## What Happens When You Add A Message To the *QOper8-wt* Queue?

Adding a Message to the queue sets off a chain of events:


1. *QOper8-wt* first checks to see if a Worker Thread process is available

  - if not, and if the Worker Thread poolsize has not yet been exceeded, *QOper8-wt*:

    - starts a new Worker Thread process, loading it with its own Worker Thread module file
    - sends an initialisation message to the new Worker Thread process with the relevent configuration parameters
    - on completion, the Worker Thread returns a message to the main process, instructing *QOper8-wt* that the Worker Thread is ready and available

  - if not, and if the maximum number of Worker Threads is already running, no further action takes place and the new message is left in the queue for later processing

  - if a Worker Thread process is available, *QOper8-wt* extracts the first message from the queue and sends it to the allocated Worker Thread process.  The Worker Thread process is flagged as *unavailable*


2. When the Worker Thread process receives the message:

  - it checks the *type* value against the *handlersByMessageType* Map.  If the associated handler method script has not been loaded into the Worker Thread, it is now loaded

  - the type-specific Handler Method is invoked, passing the incoming message object as its first argument.

3. When the Handler Method completes, the *QOper8-wt* Worker Thread returns its response object to the awaiting main process Promise.  The main *QOper8-wt* process:

  - flags the Worker Thread process as *available*
  - repeats the procedure, starting at step *1)* above again


So, as you can see, everything related to the Worker Thread processes and the message flow between the main process and the Worker Thread processes is handled automatically for you by *QOper8-wt*.  As far as you are concerned, there are just three steps:

- you ceeate a Message Handler script file for each of your required message *type*s

- you then add objects to the *QOper8-wt* queue, specifying the message *type* for each one

- you await the response object returned from the Worker Thread by your message handler


## The Message Handler Method Script

*QOper8-wt* Message Handler Method script modules must conform to a predetermined pattern as follows:

      let handler = function(messageObj, finished) {

        // your logic for processing the incoming message object (messageObj) 

        // as a result of your processing, create a response object (responseObj)

        // when processing is complete, you MUST invoke the finished() method and exit the handler method:

        return finished(responseObj);

      };

      // export the handler function

      export {handler};



The structure and contents of the response object are up to you.  

The *this* context within your handler method has the following properties and methods that you may find useful:

- *id*: the Worker Thread Id, as allocated by the QOper8 main process
- *postMessage()*: the Worker Thread's postMessage() method, allowing you to send intermediate messages back to the main QOper8 process (see later for details)
- *on()*: allows you to handle events within your handler
- *off()*: deletes an event handler
- *emit()*: generates a custom event within your handler
- *log()*: if logging is enabled in QOper8, then a time-stamped *console.log()* message can be created using this method

The *on()*, *off()*, *emit()* and *log()* methods are [described later in this document](#events).


The second argument of your handler method - the *finished()* method - is provided for you by the *QOper8-wt* Worker module.  It is used to:

- return the response object (specified as its argument) to the main *QOper8-wt* process
- instruct the main *QOper8-wt* process that processing has completed in the Worker Thread, and, as a result, the Worker Thread is flagged as *available* for handling any new incoming/queued messages
- tell *QOper8-wt* to process the first message in its queue (unless it's empty)


Your handler **MUST** always invoke the *finished()* when completed, even if you have no response to return;  Failure to invoke the *finished()* method will leave the Worker Thread unavailable for use for handling other queued messages (unless a *handlerTimeout* was defined when instantiating QOper8, in which case the Worker Thread will be terminated once this is exceeded).


For example:

      let handler = function(obj, finished) {

        // simple example that just echoes back the incoming message

        finished({
          processing: 'Message processing done!',
          data: obj.data,
          time: Date.now()
        });

      };
      export {handler};

If your handler method includes asynchronous logic, ensure that the *finished()* method is invoked only when your asynchronous logic has completed, otherwise the Worker Thread will be relased back to the available pool prematurely, eg:

      let handler = function(obj, finished) {

        // demonstration of how to handle asynchronous logic within your handler
   
        setTimeout(function() {

          finished({
            processing: 'Message processing done!',
            data: obj.data,
            time: Date.now()
          });
        }, 3000);

      };
      export {handler};
       

## How Many Message Type Handlers Can You Use?

As many as you like!  Each Worker Thread will automatically and dynamically load and cache the handler methods you've specified as it receives incoming requests.  Each Worker Thread can therefore handle as many different message types as you wish.  

You don't need separate Worker Threads for handling different message types, and nor do you need multiple instances of QOper8 to handle different types of messages and traffic.

Simply write your message handlers, tell QOper8 where to load them from and leave QOper8 to use them!


## Simple Example

This simple example creates a pool of just a single Worker Thread (the default configuration) and allows you to process a message of type *myMessage*

First, let's define the Message Handler Script file.  We'll use the example above.  Note that, since it needs to be handled as a Module by Node.js, you should specify a file extension of *.mjs*:

### myMessage.mjs

      let handler = function(obj, finished) {

        // simple example that just echoes back the incoming message

        finished({
          processing: 'Message processing done!',
          data: obj.data,
          time: Date.now()
        });

      };
      export {handler};


Now define our main Node.js script file.  Note the mapping of the *myMessage* type to the *myMessage.js* handler module.  Once again, use a file extension of *.mjs*:

### app.mjs

        import {QOper8} from 'qoper8-wt';

        // Start/Configure an instance of the *QOper8* class:

        let qoper8 = new QOper8({
          logging: true,
          handlersByMessageType: new Map([
            ['myMessage', {module: './myMessage.mjs'}]
          ]),
          workerInactivityLimit: 2
        });


        // add a message to the *QOper8-wt* queue and await its results

        let res = await qoper8.send({
          type: 'myMessage',
          data: {
            hello: 'world'
          }
        });

        console.log('Results received from Worker Thread:');
        console.log(JSON.stringify(res, null, 2));


Load and run this module:

        node app.mjs


You should see the *console.log()* messages generated at each step by *QOper8-wt* as it processes the queued message, eg:

        $ node app.mjs

        ========================================================
        qoper8-wt Build 5.0; 12 August 2022 running in process 349355
        Max worker pool size: 1
        ========================================================
        1660638301900: try processing queue: length 1
        1660638301901: no available workers
        1660638301901: starting new worker
        1660638302039: new worker 0 started...
        1660638302042: response received from Worker: 0
        1660638302042: {
          "threadId": 1
        }
        1660638302043: try processing queue: length 1
        1660638302043: worker 0 was available. Sending message to it
        1660638302043: Message received by worker 0: {
          "type": "myMessage",
          "data": {
            "hello": "world"
          }
        }
        1660638302056: response received from Worker: 0
        1660638302056: {
          "processing": "Message processing done!",
          "data": {
            "hello": "world"
          },
          "time": 1660638302054
        }
        1660638302057: try processing queue: length 0
        1660638302057: Queue empty
        Results received from Worker Thread:
        {
          "processing": "Message processing done!",
          "data": {
            "hello": "world"
          },
          "time": 1660638302054,
          "qoper8": {
            "finished": true
          }
        }


If you now leave the web page alone, you'll see the messages generated when it periodically checks the Worker Thread process for inactivity.  Eventually you'll see it being shut down automatically, eg:

        1660638703175: Worker 0 inactive for 60047
        1660638703175: Inactivity limit: 120000
        1660638763236: Worker 0 inactive for 120108
        1660638763241: response received from Worker: 0
        1660638763242: {}
        1660638763242: QOper8 is shutting down Worker Thread 0
        1660638763237: Inactivity limit: 120000
        1660638763239: Worker 0 sending request to shut down

        $


Alternatively, you can shut down the Node.js process by typing *CTRL & C*, in which case you'll see *QOper8-wt* gracefully terminating the Worker Threads before shutting itself down, eg:

        ^C1660638577024: *** CTRL & C detected: shutting down gracefully...
        1660638577026: Worker Thread 0 is being stopped
        1660638577028: Message received by worker 0: {
          "type": "qoper8_terminate"
        }
        1660638577030: response received from Worker: 0
        1660638577030: {}
        1660638577031: QOper8 is shutting down Worker Thread 0
        1660638577031: Worker Thread 0 has been stopped (1)
        1660638577032: No Worker Threads are running: QOper8 is no longer handling messages
        1660638577029: Worker 0 sending request to shut down

        $



## How Many Worker Threads Should I Use?

It's entirely up to you.  Each Worker Thread in your pool will be able to invoke your type-specific message handlers, and each will run identically.  There's a few things to note:

- Having more than one Worker Thread will allow a busy workload of queued messages to be shared amongst the Worker Thread pool;

- if you have more than one Worker Thread, you have no control over which Worker Thread handles each message you add to the *QOper8-wt* queue.  This should normally not matter to you, but you need to be aware;

- A *QOper8-wt* Worker Thread process only handles a single message at a time.  The Worker Thread is not available again until it invokes the *finished()* method within your handler.

- You'll find that overall throughput will initially increase as you add more Worker Threads to your pool, but you'll then find that throughput will start to decrease as you further increase the pool.  It will depend on a number of factors, but primarily the number of CPU cores available on the machine running Node.js and *Qoper8-wt*.  Typically optimal throughput is achieved with between 3 and 7 Worker Threads.

- If you use just a single Worker Thread, your queued messages will be handled individually, one at a time, in strict chronological sequence.  This can be advantageous for certain kinds of activity where you need strict control over the serialisation of activities.  The downside is that the overall throughput will be typically less than if you had a larger Worker Thread pool.


## Optional Worker Thread Initialisation

*Qoper8-wt* initialises Worker Threads whenever it starts them up, but only to the extent needed by *QOper8-wt* itself.

Whenever a new *QOper8-wt* Worker Thread starts up, you may want/need to add your own custom initialisation logic, eg:

- connecting the Worker Thread to an external resource such as a database;
- augmenting the *QOper8-wt* Worker Thread's *this* context (which is then accessible to your message type handlers).  For example, adding methods etc to allow authorised access to an external resource such as a database.

*QOper8-wt* provides two ways in which you can do this:

- via a *QOper8-wt* property in the *options* object used when instantiating *QOper8-wt*;
- via a method provided by *QOper8-wt* after it has been instantiated


In both cases, you need to provide:

- the path or name of a module that contains your Worker Thread startup/initialisation logic
- the specific run-time arguments you want to supply to your startup/initialisation module each time a Worker Thread is started by *QOper8-wt*


### Structure of a QOper8-wt Startup/Initialisation Module
  
A *QOper8-wt* Startup/Initialisation Module should export a function as *{onStartupModule}*, eg:


        let onStartupModule = function(props) {
          props = props || {};

          // augment this, so your custom properties/method are available
          // to your message type handlers

          this.foo = props.foo;
          this.bar = props.bar;

          // add any Worker Thread shutdown logic

          this.on('stop', function() {
            console.log('Worker Thread is about to be shut down by QOper8-wt');
            // perform any resource disconnection/tear-down logic
          });
        };

        export {onStartupModule};

Note that the function should take a single argument that can be either a simple scalar value or a complex object.  The structure and content of this argument is up to you to determine.


### Using the QOper8 Class Constructor's *options* Object

You provide a sub-object named *onStartup* which has two properties:

- *module*: the path or name of your Startup/Initialisation module (allowing QOper8 to find and import it);
- *arguments*: the run-time value(s) for your Startup/Initialisation module's argument property/object

For example:


        let qoper8 = new QOper8({
          logging: true,
          handlersByMessageType: new Map([
            ['myMessage', {module: './myMessage.mjs'}]
          ]),
         
          onStartup: {
            module: './myStartupModule.mjs',
            arguments: {
              foo: 'foo 123',
              bar: function() {
                // my bar function
              }
            }
          }

        });


### Using *QOper8-wt*'s *setOnStartupModule()* Method

If you want/need to define the Startup/Initialisation Module after *QOper8-wt* has been instantiated (eg when using a module or framework that looks after the instantiation of *QOper8-wt*), then you can invoke its *setOnStartupModule()* method.  Note that, for security reasons, you can only invoke this function if:

- the *onStartup* option has not already been used when instantiating *QOper8-wt*; and
- the *setOnStartupModule()* method has not already been invoked

In other words, you can only define your Worker Thread Startup/Initialisation mechanism once, after which it cannot be changed (eg in a malicious or unauthorised way).

The *setOnStartupModule()* method takes a single argument which is an object with two properties:

- *module*: the path or name of your Startup/Initialisation module (allowing *QOper8-wt to find and import it);
- *arguments*: the run-time value(s) for your Startup/Initialisation module's argument property/object

For example:

        let qoper8 = new QOper8({
          logging: true,
          handlersByMessageType: new Map([
            ['myMessage', {module: './myMessage.mjs'}]
          ])
        });

        // ... then later...

        qoper8.setOnStartupModule({
          module: './myStartupModule.mjs',
          arguments: {
            foo: 'foo 123',
            bar: function() {
              // my bar function
            }
          }
        });



## *QOper8-wt* Fault Resilience

QOper8 is designed to be robust and allow you to control and handle unforseen events.

### Handling Errors in Worker Threads

The most likely error you'll experience is where a Worker Thread Message Handler method has crashed due to some fault within its logic.  If this happens, *QOper8-wt* will:

- return an error object to your awaiting *send()* Promise. This object also includes the original queued request object, allowing you to re-queue it and re-handle it if this is a sensible and/or feasible option for you.  For example, if you sent a request:


      let res = await qoper8.send({
        type: 'test',
        hello: 'world'
      });


  If the message hander for a message of type *test* crashed, then *res* would be returned as:

      {
        "error": "Error running Handler Method for type test",
        "caughtError": "{\"stack\":\"ReferenceError: y is not defined\\n...etc}",
        "originalMessage": {
          "type": "test",
          "hello": "world"
        },
        "workerId": 0,
        "qoper8": {
          "finished": true
        }
      }

  The *caughtError* is a stringified copy of the error caught by QOper8's *try..catch* around the handler that failed.  This should provide you with the information needed to debug the issue.

  The original request object is returned to you under the *originalMessage* property.  It is up to you to decide what, if anything you want to do with it.

  The *workerId* and *qoper8* properties are primarily for internal use within QOper8.


- QOper8 will terminate the Worker Thread in which the error occurred and remove it from QOper8's available pool.  This is to prevent any unwanted side-effects from any delayed asynchronous logic that may be running within the Worker Thread despite the error that occurred.  

  Note that QOper8 will always automatically start new Worker Threads if it needs to, and this, coupled with the fact that a QOper8 Worker Thread only ever handles a single message at a time, means that shutting down Worker Threads is a safe thing for QOper8 to do.

### Handling a Handler that Never Completes

By default, if you QOper8 Worker Thread handler method failed to complete (eg due to an infinite loop, or because it was hanging awaiting a resource that was unavailable), then that Worker Thread will remain unavailable to QOper8.  This will reduce throughtput, and if the same situation occurs in other Worker Threads, you could end up with a stalled system with no available Worker Threads.

To handle such situations, you should specify a *handlerTimeout* when instantiating QOper8.  The *handlerTimeout* is specified in milliseconds, eg the following would instruct QOper8 to force a Worker Thread timeout if a handler took longer than a minute to return its results:

      let qoper8 = new QOper8({
        handlersByMessageType: new Map([
          ['test', {module: './test.mjs'}]
        ]),
        poolSize: 2,
        handlerTimeout: 60000
      });


If a handler method exceeds this timeout, QOper8 will:

- return an error response to the awaiting *send()* Promise.  The error response object includes the original request object.  It is for you to determine what to do with the original request object, for example you may decide to re-queue it.

  For example, if you sent a request:

      let res = await qoper8.send({
        type: 'test',
        hello: 'world'
      });

and the *test* Message Handler method failed to respond within a minute, then the value of *res* that was returned would be: 


      {
        error: 'Worker Thread handler timeout exceeded',
        originalRequest: {
          type: 'test',
          hello: 'world'
        }
      };

- terminate the Worker Thread, effectively stopping any processing that was taking place in the Worker Thread.

  Note that QOper8 will always automatically start new Worker Threads if it needs to, and this, coupled with the fact that a QOper8 Worker Thread only ever handles a single message at a time, means that shutting down Worker Threads is a safe thing for QOper8 to do.


### Handling a Crash in the Main Node.js Process

If the main Node.js process experiences an unforeseen crash, you will not only lose the currently executing Worker Threads, but you'll also lose QOper8's queue since, for performance reasons, it is an in-memory array structure.

Under most circumstances, the QOper8 queue should be empty, but in a busy system this may not be the case, and if you are running a safety-critical system, the resilience of the queue may be an important/vital factor, in which case you need to be able to restore any requests that may have been in the queue and also any requests that had not been handled to completion within Worker Threads.

#### Maintaining a Backup of the Queue

QOper8 does not, itself, provide a resilient queue, but it does provide hooks via which you can optionally provide your own resilience, eg allowing you to maintain an active copy of the queue in the Redis database.  You do this by specifying a property named *QBackup* when instantiating QOper8.  This must be an object containing two functions named *add* and *delete*, eg:


      let QBackup = {
        add: function(id, requestObject) {
          // your code for saving the requestObject using id as the unique key
        },
        delete: function(id) {
          // your code for deleting the record identified by id as the key
        }
      };

      let qoper8 = new QOper8({
        handlersByMessageType: new Map([
          ['test', {module: './test.mjs'}]
        ]),
        poolSize: 2,
        handlerTimeout: 60000,
        QBackup: QBackup
      });


If QBackup methods are defined:

- whenever a message is added to the QOper8 queue (via either the *send()* or *message()* APIs), the *add()* method will be fired.  This allows you to add a copy of the queued request using a unique request Id that QOper8 provides you.

- whenever a response is received by QOper8 from a Worker Thread, provided this was as a result of the *finished()* method within the Worker Thread, the *delete()* method is fired, passing you the unique Id of the message that has now completed. This allows you to delete the now-handled message from the copy of the queue.

#### Recovery

If the main Node.js process experiences an unforeseen crash, it is your responsibility to recreate the queue from your backup storage.  To do this, restart QOper8 and then simply re-queue the messages from your database copy, using, eg, the following pseudo-code:

      for (const requestObject in yourDatabase) {

        // use QOper8's message API to requeue the request object:
        qoper8.message(requestObject);

        delete requestObject from yourDatabase;
      }

QOper8 will immediately begin processing requests as they are added to the queue, and will begin firing your corresponding QBackup *add()* and *delete() methods as the requests are queued and completed, so you should probably shouldn't rebuild the QOper8 queue directly from your active backup store to prevent any unwanted synchronisation issues within your backup store.

Note that QOper8's approach to resilience means that its throughput is not constrained by the performance of a separate database-based queue.  You should, however, ensure that your storage logic within your *QBackup* *add()* and *delete()* APIs is asynchronous, to avoid blocking QOper8's main process.

Note also that it is your responsibility to ensure the integrity of your backup queue.  QOper8 can only ensure that you are provided with the correct signals at the appropriate times to allow you to maintain an accurate representation of the currently active queue and uncompleted requests.

Note also that, under the terms of QOper8's Apache2 license, you use QOper8 at your own risk and no warranties are provided.


## Benchmarking *QOper8-wt* Throughput

The performance of *QOper8-wt* will depend on many factors, in particular the size of your request and response objects, and also the amount and complexity of the processing logic within your Worker Thread Handler methods.  It will also be impacted if your Handler logic includes access to external resources (eg via REST or other external networking APIs).

However, to get an idea of likely best-case throughput performance of *QOper8-wt* on your system, you can use the benchmarking test script that is included in the [*/benchmark*](./benchmark) folder of this repository.

To run it, create a Node.js script file (eg *benchmark.mjs*), following this pattern:

        import {benchmark} from 'qoper8-wt/benchmark';

        benchmark({
          poolSize: 3,
          maxMessages: 100000,
          blockLength:1400,
          delay: 135
        });

The benchmark test script allows you to specify the Worker Thread Pool Size, and you then set up the parameters for generating a stream of identical messages that will be handled by a simple, built-in almost "do-nothing" message handler.  

You specify the total number of messages you want to generate, eg 100,000, but rather than the application simply adding the whole lot to the *QOper8-wt* queue in one go, you define how to generate batches of messages that get added to the queue.  So you define:

- the message block size, eg 1400 messages at a time
- the delay time between blocks of messages, eg 135ms

This avoids the performance overheads of the browser's JavaScript run-time handling a potentially massive array which could potententially adversely affect the performance throughput.

The trick is to create a balance of batch size and delay to maintain a sustainably-sized queue.  The application reports its work and results to the browser's JavaScript console, and will tell you if the queue increases with each message batch, or if the queue is exhausted between batches.

Keep tweaking the delay time:

- increase it if the queue keeps expanding with each new batch
- decrease it if the queue is getting exhausted at each batch

At the end of each run, the application will display, in the JavaScript console:

- the total time taken
- the throughtput rate (messages handled per second)
- the number of messages handled by each of the Worker Threads in the pool you specified.


For example:

        benchmark({
          poolSize: 3,
          maxMessages: 5000,
          blockLength:100,
          delay: 140
        });



        $ node benchmark.mjs

        Block no: 1 (0): Queue exhausted
        Block no: 2 (100): queue length increased to 100
        Block no: 3 (200): Queue exhausted
        Block no: 4 (300): Queue exhausted
        Block no: 5 (400): Queue exhausted
        Block no: 6 (500): Queue exhausted
        Block no: 7 (600): Queue exhausted
        Block no: 8 (700): Queue exhausted
        Block no: 9 (800): Queue exhausted
        Block no: 10 (900): Queue exhausted
        Block no: 11 (1000): Queue exhausted
        Block no: 12 (1100): Queue exhausted
        Block no: 13 (1200): Queue exhausted
        Block no: 14 (1300): Queue exhausted
        Block no: 15 (1400): Queue exhausted
        Block no: 16 (1500): Queue exhausted
        Block no: 17 (1600): Queue exhausted
        Block no: 18 (1700): Queue exhausted
        Block no: 19 (1800): Queue exhausted
        Block no: 20 (1900): Queue exhausted
        Block no: 21 (2000): Queue exhausted
        Block no: 22 (2100): Queue exhausted
        Block no: 23 (2200): Queue exhausted
        Block no: 24 (2300): Queue exhausted
        Block no: 25 (2400): Queue exhausted
        Block no: 26 (2500): Queue exhausted
        Block no: 27 (2600): Queue exhausted
        Block no: 28 (2700): Queue exhausted
        Block no: 29 (2800): Queue exhausted
        Block no: 30 (2900): Queue exhausted
        Block no: 31 (3000): Queue exhausted
        Block no: 32 (3100): Queue exhausted
        Block no: 33 (3200): Queue exhausted
        Block no: 34 (3300): Queue exhausted
        Block no: 35 (3400): Queue exhausted
        Block no: 36 (3500): Queue exhausted
        Block no: 37 (3600): Queue exhausted
        Block no: 38 (3700): Queue exhausted
        Block no: 39 (3800): Queue exhausted
        Block no: 40 (3900): Queue exhausted
        Block no: 41 (4000): Queue exhausted
        Block no: 42 (4100): Queue exhausted
        Block no: 43 (4200): Queue exhausted
        Block no: 44 (4300): Queue exhausted
        Block no: 45 (4400): Queue exhausted
        Block no: 46 (4500): Queue exhausted
        Block no: 47 (4600): Queue exhausted
        Block no: 48 (4700): Queue exhausted
        Block no: 49 (4800): Queue exhausted
        Block no: 50 (4900): Queue exhausted
        Completed sending messages
        ===========================

        5000 messages: 7.16 sec
        Processing rate: 698.3240223463687 message/sec
        Worker Thread 0: 1767 messages handled
        Worker Thread 1: 1735 messages handled
        Worker Thread 2: 1498 messages handled

        ===========================
        $

You can see in this test run, the queue was constantly being exhausted: it was being processed faster than it was being refilled.  If we reduce the delay time right down, eg:

        benchmark({
          poolSize: 3,
          maxMessages: 5000,
          blockLength:100,
          delay: 10
        });


        webmaster@mgateway:~/node_projects$ node benchmark.mjs
        Block no: 1 (0): Queue exhausted
        Block no: 2 (100): queue length increased to 100
        Block no: 3 (200): queue length increased to 200
        Block no: 4 (300): queue length increased to 300
        Block no: 5 (400): queue length increased to 400
        Block no: 6 (500): queue length increased to 500
        Block no: 7 (600): queue length increased to 600
        Block no: 8 (700): queue length increased to 700
        Block no: 9 (800): queue length increased to 800
        Block no: 10 (900): queue length increased to 900
        Block no: 11 (1000): queue length increased to 1000
        Block no: 12 (1100): queue length increased to 1100
        Block no: 13 (1200): queue length increased to 1200
        Block no: 14 (1300): queue length increased to 1300
        Block no: 15 (1400): queue length increased to 1399
        Block no: 16 (1500): queue length increased to 1471
        Block no: 17 (1600): queue length increased to 1530
        Block no: 18 (1700): queue length increased to 1605
        Block no: 19 (1800): queue length increased to 1677
        Block no: 20 (1900): queue length increased to 1754
        Block no: 21 (2000): queue length increased to 1819
        Block no: 22 (2100): queue length increased to 1886
        Block no: 23 (2200): queue length increased to 1939
        Block no: 24 (2300): queue length increased to 2036
        Block no: 25 (2400): queue length increased to 2098
        Block no: 26 (2500): queue length increased to 2159
        Block no: 27 (2600): queue length increased to 2205
        Block no: 28 (2700): queue length increased to 2258
        Block no: 29 (2800): queue length increased to 2304
        Block no: 30 (2900): queue length increased to 2328
        Block no: 31 (3000): queue length increased to 2386
        Block no: 32 (3100): queue length increased to 2453
        Block no: 33 (3200): queue length increased to 2497
        Block no: 34 (3300): queue length increased to 2519
        Block no: 35 (3400): queue length increased to 2562
        Block no: 36 (3500): queue length increased to 2590
        Block no: 37 (3600): queue length increased to 2618
        Block no: 38 (3700): queue length increased to 2676
        Block no: 39 (3800): queue length increased to 2702
        Block no: 40 (3900): queue length increased to 2731
        Block no: 41 (4000): queue length increased to 2752
        Block no: 42 (4100): queue length increased to 2769
        Block no: 43 (4200): queue length increased to 2796
        Block no: 44 (4300): queue length increased to 2819
        Block no: 45 (4400): queue length increased to 2844
        Block no: 46 (4500): queue length increased to 2868
        Block no: 47 (4600): queue length increased to 2894
        Block no: 48 (4700): queue length increased to 2916
        Block no: 49 (4800): queue length increased to 2959
        Block no: 50 (4900): queue length increased to 3008
        Completed sending messages
        ===========================

        5000 messages: 0.959 sec
        Processing rate: 5213.76433785193 message/sec
        Worker Thread 0: 2021 messages handled
        Worker Thread 1: 1512 messages handled
        Worker Thread 2: 1467 messages handled

        ===========================

This time you can see that the queue is building faster than it is being consumed, but you can also see that the processing rate has gone up from 700 message/sec to 5200/sec.

Tweaking the delay time a little more, we should be able to find a better balance where the queue is neither growing nor being exhausted, except occasionally, eg with a 14ms delay in this example:

        webmaster@mgateway:~/node_projects$ node benchmark.mjs
        Block no: 1 (0): Queue exhausted
        Block no: 2 (100): queue length increased to 100
        Block no: 3 (200): queue length increased to 200
        Block no: 4 (300): queue length increased to 300
        Block no: 5 (400): queue length increased to 400
        Block no: 6 (500): queue length increased to 500
        Block no: 7 (600): queue length increased to 600
        Block no: 8 (700): queue length increased to 700
        Block no: 9 (800): queue length increased to 799
        Block no: 10 (900): queue length increased to 890
        Block no: 11 (1000): queue length increased to 962
        Block no: 12 (1100): queue length increased to 967
        Block no: 46 (4500): Queue exhausted
        Block no: 47 (4600): Queue exhausted
        Block no: 48 (4700): Queue exhausted
        Block no: 49 (4800): Queue exhausted
        Block no: 50 (4900): Queue exhausted
        Completed sending messages
        ===========================

        5000 messages: 0.809 sec
        Processing rate: 6180.469715698393 message/sec
        Worker Thread 0: 2004 messages handled
        Worker Thread 1: 1661 messages handled
        Worker Thread 2: 1335 messages handled

        ===========================

and you can now see that we're hitting the optimum throughput for this system, which is nearly 6200 messages/sec across 3 Worker Threads.  You can see the distribution of messages across the Worker Threads which, as you can see, isn't necessarily  an even distribution.


**Note**: You can also use the benchmark tool to stress-test any queue backup logic that you may be providing.  You can also measure what, if any, performance impact your backup strategy has on best-case throughput.

Simply add the *QBackup* APIs to the benchmark's constructor, eg:

        import {benchmark} from 'qoper8-wt/benchmark';

        let QBackup = {
          add: function(id, requestObject) {
            // your code for saving the requestObject using id as the unique key
          },
          delete: function(id) {
            // your code for deleting the record identified by id as the key
          }
        };

        benchmark({
          poolSize: 3,
          maxMessages: 100000,
          blockLength:1400,
          delay: 135,
          QBackup: QBackup
        });


Note that at the end of each benchmark run, your backup queue should be empty!


## Optionally Packaging Your Message Handler Code

As you'll have seen above, the default way in which *QOper8-wt* dynamically loads each of your Message Handler script files is via a corresponding file path that you define in the *QOper8-wt* constructor's *handlersByMessageType* property.

When a Message Handler Script File is needed by *QOper8-wt*, it dynamically imports it as a module.  This is the standard way to load modules into Worker Threads, but of course, it means that each of your Message Handler Script Files need to reside in a file that is fetched via the file path you've specified.

This approach is OK, but you may want to create a single Node.js file that includes all your logic, including that of your Worker Message Handler scripts.

*QOper8-wt* therefore provides an alternative way to define and specify your type-specific Message Handlers by creating a string that contains just the processing code.  

For example:

        let handlerFn = `
          let foo = message.data.foo;
          let bar = 'xyz'
          finished({
            processing: 'Message processing done!',
            foo: foo,
            bar: bar,
            time: Date.now()
          });
        `;

Note the use of back-ticks around the code.  Basically you're leaving off the function wrapper which is added automatically at run-time to create:

        function(message, finished) {
          let foo = message.data.foo;
          let bar = 'xyz'
          finished({
            processing: 'Message processing done!',
            foo: foo,
            bar: bar,
            time: Date.now()
          });
        }

Note that the message object will **always** be passed in using the argument *message*.


You now use this in the QOper8-wt *handlersByMessageType* property by specifying a *text* object, eg:

          handlersByMessageType: new Map([
            ['myMessage', {text: 'handlerFn'}]
          ]),


Pulling this together, let's repackage the earlier example:


        import {QOper8} from 'qoper8-wt';

        let handlerFn = `
          finished({
            processing: 'Message processing done!',
            data: message.data,
            time: Date.now()
          });
        `;

        let qoper8 = new QOper8({
          logging: true,
          handlersByMessageType: new Map([
            ['myMessage', {text: 'handlerFn'}]
          ]),
          workerInactivityLimit: 2
        });

        let res = await qoper8.send({
          type: 'myMessage',
          data: {
            hello: 'world'
          }
        });

        console.log('Results received from Worker Thread:');
        console.log(JSON.stringify(res, null, 2));


So you now have everything defined in a single Node.js script file.



## Additional *QOper8-wt* APIs

- As an alternative to the *send()* API, you can use the asynchronous *message()* API which allows you to define a callback function for handling the response returned by the Worker Thread that processed the message, eg:

      qoper8.message(messageObj, function(responseObj) {

        // handle the returned response object

      });

This can be convenient and also the most efficient way to handle "fire and forget" messages that you want to send to a Worker Thread, but where you don't need to handle the response, eg:

      qoper8.message(messageObj);

- You can use the *log()* API to display date/time-stamped console.log messages.  To use this API, you must configure *QOper8-wt* with *logging: true* as one of its configuration option properties.  For example:

      qoper8.log('This is a message');

      // 1656004435581: This is a message

  This can be helpful to verify the correct chronological sequence of events within the console log when debugging.

- qoper8.getStats(): Returns an object that provides you with a range of information and statistics about activity within the main QOper8-wt process and the Worker Threads.  You can invoke this API at any time.

- qoper8.getQueueLength(): Returns the current queue length.  Under most circumstances this should usually return zero.

- qoper8.stop(): Controllably shuts down all Worker Threads in the pool and prevents any further messages being added to the queue.  Any messages currently in the queue will remain there and will not be processed.

- qoper8.start(): Can be used after a *stop()* to resume *QOper8-wt*'s ability to add messages to its queue and to process them.  *QOper8-wt* will automatically start up new Worker Thread(s).


### Properties:

- qoper8.name: returns **QOper8-wt**

- qoper8.build: returns the build number, eg 5.0

- qoper8.buildDate: returns the date the build was created

- qoper8.logging: read/write property, defaults to *false*.  Set it to *true* to see a trace of *QOper8-wt* foreground and Worker Thread activity in the JavaScript console.  Set to false for production systems to avoid any overheads.

## Events

The *QOper8-wt* module allows you to emit and handle your own specific custom events


- Define an event handler using the *on()* method, eg:

      qoper8.on('myEvent', function(dataObj) {
        // handle the 'myEvent' event
      });

  The first argument can be any string you like.

- Emit an event using the *emit()* method, eg:

      qoper8.emit('myEvent', {foo: bar}):

  The second argument can be either a string or object, and is passed to the callback of the associated *on()* method.


- Remove an event handler using the *off()* method, eg:

      qoper8.off('myEvent');

Note that repeated calls to the *on()* method with the same event name will be ignored if a handler has already been defined.  To change/replace an event handler, first delete it using the *off()* method, then redefine it using the *on()* method.


*QOper8-wt* itself emits a number of events that you can handle, both in the main process and within the Worker Thread(s).

The Main process *QOper8-wt* event names are:

- *workerStarted*: emitted whenever a Worker Thread starts
- *addedToQueue*: emitted whenever a new message is added to the queue
- *sentToWorker*: emitted whenever a message is removed from the queue and sent to a Worker Thread
- *replyReceived*: emitted whenever a response message from a Worker Thread is received by the main browser process 
- *stop*: emitted whenever *QOper8-wt* is stopped using the *stop()* API
- *start*: emitted whenever *QOper8-wt* is re-started using the *start()* API

You can provide your own custom handlers for these events by using the *on()* method within your main module.


The Worker Thread event names are:

- *started*: emitted when the Worker Thread has started and been successfully initialised by the main *QOper8-wt* process
- *handler_imported*: emitted on successful import of a message type handler module
- *received*: emitted whenever the Worker Thread receives a message from the main *QOper8-wt* process
- *finished*: emitted whenever the *finished()* method has been invoked
- *shutdown_signal_sent*: emitted whenever the Worker Thread sends a message to the main *QOper8-wt* process, signalling that it is to be shut down (as a result of inactivity)
- *error*: emitted whenever errors occur during processing within the Worker Thread

You can provide your own custom handlers for these events by using the *this.on()* method within your message type handler module(s).  Note, as explained earlier, that repeated use of *this.on()* for the same event name will be ignored.


## Handling Intermediate Messages

In most situations, you'll use the *finished()* API within your Message Handler scripts in order to return your messages to the main *QOper8-wt* process.  

Sometimes, however, you may need to send additional, intermediate messages from the Worker Thread before you finally signal completion of your handler processing with the *finished()* method.

In order to send such intermediate messages, *QOper8-wt* provides you with access to the Worker Thread's *parentPort.postMessage()* API, via the *this* context within your Handler script, eg:

- in your message type handler:

      this.postMessage({
        type: 'custom',
        data: {
          foo: 'bar'
        }
      });

The trick to making use of such intermediate messages within the main *QOper8-wt* process is to set up a custom event handler that makes use of *QOper8-wt*'s *replyReceived* event.  Your intermediate message will be accessible as *res.reply*, eg

- in your main module

      qoper8.on('replyReceived', function(res) {
        if (res.reply.type === 'custom') {
          // do something with res.reply.data
        }
      });

**Note**: that you must **ALWAYS** use the *finished()* API within your message handler scripts to signal that you have finished using the Worker Thread, even if you use intermediate messages.  Failure to invoke the *finished()* API will mean that the Worker Thread is not released back into the *QOper8-wt* available pool, so it cannot be used to handle any further messages in the queue.


## License

 Copyright (c) 2022 M/Gateway Developments Ltd,                           
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


