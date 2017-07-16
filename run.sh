basepath=$(cd `dirname $0`; pwd)
log_filename=$basepath/log/`date "+%Y_%m_%d_%H_%M_%S"`.log

node index.js > $log_filename
