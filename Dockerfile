# al:2 에서 al:2023 버전으로 변경 (node v18 이슈)
# (오류) node: /lib64/libm.so.6: version `GLIBC_2.27' not found (required by node)
# downgrade node v18 > v14 (S3 acced denied 이슈로 일단 다운그레이드 함.)
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

# 18 버전 -> 다운그레이드 함
RUN source ~/.bashrc && nvm install 14.15.1

WORKDIR /build
