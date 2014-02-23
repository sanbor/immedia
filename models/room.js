var mongoose = require('mongoose');
var Room = module.exports = new mongoose.Schema({
  name: String,
  password: String
});
