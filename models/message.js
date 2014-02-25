var mongoose = require('mongoose');
var messageSchema= new mongoose.Schema({
  timestamp: Number,
  text: String,
  image: String,
  roomId: mongoose.Schema.Types.ObjectId
});
var Message = module.exports = mongoose.model('Message', messageSchema);
