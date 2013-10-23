#!/bin/bash

useradd -r rohrpost || :
mkdir /var/log/rohrpost || :
mkdir /etc/rohrpost || :
cp -r config/* /etc/rohrpost/ || :
rm /etc/rohrpost/README.md || :
chown rohrost /var/log/rohrpost
chmod a+w -R /var/log/rohrpost
chmod a+w -R /etc/rohrpost

