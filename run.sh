basepath=$(cd `dirname $0`; pwd)
mkdir -p $basepath/log
log_filename=$basepath/log/`date "+%Y_%m_%d_%H_%M_%S"`.log

node index.js > $log_filename
