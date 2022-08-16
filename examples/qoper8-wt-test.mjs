import {QOper8} from 'qoper8-wt';

let fnText = `
  finished({
    time: Date.now(),
    received: message
  });
`;

let q = new QOper8({
  logging: true,
  maxQLength: 10,
  workerInactivityLimit: 2,
  handlersByMessageType: new Map([
    //['test', {text: fnText}]
    ['test', {module: './testHandler.mjs'}]
  ])
});

let msg = {
  type: 'test',
  hello: 'world'
};

let res = await q.send(msg);
console.log(22222);

console.log(JSON.stringify(res, null, 2));

//console.log('*** stopping! ****');
//q.stop();

res = await q.send({type: 'qoper8_getStats'});
console.log('*** stats: ' + JSON.stringify(res, null, 2));

res = await q.getStats();
console.log('*** stats 2: ' + JSON.stringify(res, null, 2));


setTimeout(async function() {
  console.log(33333333);
  let res = await q.send(msg);
  console.log(22222);

  console.log('response is: ' + JSON.stringify(res, null, 2));
}, 2000);