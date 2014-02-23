var mongoose = require('mongoose');
var roomSchema= new mongoose.Schema({
  name: String,
  password: String
});
var Room = module.exports = mongoose.model('Room', roomSchema);
