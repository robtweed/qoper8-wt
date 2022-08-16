let handler = function(message, finished) {
  console.log('in test handler module!');

  setTimeout(function() {
    finished({
      time: Date.now(),
      received: message
    });
  }, 5000);
};
export {handler};