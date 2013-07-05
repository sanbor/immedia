CROUD = {};

function timeLog() {
  [].unshift.apply(arguments, ["[" + Math.round((new Date().getTime())/10)%10000 + "]"]);
  console.log.apply(console, arguments);
}
