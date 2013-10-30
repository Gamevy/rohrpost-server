#!/bin/bash

# Taken losely from https://gist.github.com/tilfin/5004848
prgcmd=rohrpost # What gets executed?
prgname=rohrpost # What's the name (used to ensure only one instance is running)
prguser=rohrpost # Which user should be used
pidfile=/var/run/rohrpost.pid # Where should the pid file be stored?

start() {
    if [ -f $pidfile ]; then
        pid=`cat $pidfile`
        kill -0 $pid >& /dev/null
        if [ $? -eq 0 ]; then
            echo "Rohrpost has already been started."
            return 1
        fi
    fi

    nohup start-stop-daemon -c $prguser -n $prgname -p $pidfile -m --exec /usr/bin/env --start $prgcmd >>/var/log/rohrpost/all.log 2>&1 &

    if [ $? -eq 0 ]; then
        echo "Rohrpost started."
        return 0
    else
        echo "Failed to start rohrpost."
        return 1
    fi
}

stop() {

    if [ ! -f $pidfile ]; then
        echo "Rohrpost not started."
        return 1
    fi

    start-stop-daemon -p $pidfile --stop
    if [ $? -ne 0 ]; then
        echo "Failed to stop rohrpost."
        return 1
    fi

    echo -n "Waiting for workers to close their connections..."
    while true
    do
        processCount=`ps aux | grep node | grep rohrpost | wc -l`

        if [ $processCount -eq 0 ]; then
            break
        fi

        sleep 3
        echo -n "."
    done

    echo -e "\nRohrpost stopped."
    rm $pidfile
}

status() {

    if [ -f $pidfile ]; then
        pid=`cat $pidfile`
        kill -0 $pid >& /dev/null
        if [ $? -eq 0 ]; then
            echo "Rohrpost running. (PID: ${pid})"
            return 0
        else
            echo "Rohrpost might have crashed. (PID: ${pid} file remains)"
            return 1
        fi
    else
        echo "Rohrpost not started."
        return 0
    fi
}

restart() {
    stop
    if [ $? -ne 0 ]; then
        return 1
    fi

    sleep 2

    start
    return $?
}

case "$1" in
    start | stop | status | restart)
        $1
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        exit 2
esac

exit $?