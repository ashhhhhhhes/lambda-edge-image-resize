FROM amazonlinux:2

WORKDIR /tmp

#install the dependencies
RUN yum -y update
RUN yum -y install gcc-c++
RUN yum -y install findutils
RUN yum -y install tar gzip
RUN yum -y install glibc

RUN touch ~/.bashrc && chmod +x ~/.bashrc

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

RUN source ~/.bashrc && nvm install 14.15.1

WORKDIR /build
