
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'CraudWatcher' });
};

exports.maker = function(req, res){
  res.render('maker', { title: 'CraudMaker' });
};
