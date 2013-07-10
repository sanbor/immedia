
/*
 * GET home page.
 */

exports.slave = function(req, res){
  res.render('slave');
};

exports.master = function(req, res){
  res.render('master');
};
