/*
 * GET home page.
 */

exports.slave = function(req, res){
  res.render('slave');
};

exports.master = function(req, res){
  res.render('master');
};

/**
 * New routes created for wormhole ansible epxloration
 */

exports.office = function(req, res) {
  res.render('office');
};
exports.participant = function(req, res) {
  res.render('participant');
};
