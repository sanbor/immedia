var mongoose = require('mongoose');
var roomSchema= new mongoose.Schema({
  name: String,
  password: String,
  shortname: String,
  // Maximum age of documents to keep in the database
  // Defaults to one week
  max_message_age: { type: Number, default: 1000*60*60*24*7 }
});
var Room = module.exports = mongoose.model('Room', roomSchema);
