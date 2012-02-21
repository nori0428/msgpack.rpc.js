#!/bin/sh

JAVA=`which java`
JSDOC_TOOLKIT_DIR=`pwd`/tool/jsdoc-toolkit
JSRUN_JAR=$JSDOC_TOOLKIT_DIR/jsrun.jar
RUN_JS=$JSDOC_TOOLKIT_DIR/app/run.js
TEMPLATE=$JSDOC_TOOLKIT_DIR/templates/jsdoc
OUTDIR=`pwd`/doc

SOURCE=msgpack.rpc.js

echo $JAVA -jar $JSRUN_JAR $RUN_JS -t=$TEMPLATE $SOURCE -d=$OUTDIR
$JAVA -jar $JSRUN_JAR $RUN_JS -t=$TEMPLATE $SOURCE -d=$OUTDIR
