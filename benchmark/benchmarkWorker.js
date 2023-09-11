let handler = function(msg, finished) {
  finished({
    messageNo: msg.messageNo,
    workerId: this.id,
    count: this.getMessageCount(),
  });
};

export {handler};

  