# build.sh
#!/bin/bash

# docker를 빌드
docker build -t amazon-nodejs .

echo 'docker volume =====>'  ${PWD}/src:/build 

# 빌드된 이미지로 sharp를 제외한 라이브러리 설치 (querystring, request)
# 빌드된 결과를 /src에 동기화하기 위해 --volume 옵션 사용
docker run --rm --volume ${PWD}/src:/build amazon-nodejs /bin/bash -c \
"source ~/.bashrc; npm init -f -y; npm install querystring --save; npm install request --save;npm install --only=prod"


echo '================ install sharp ================'

# Corss-Platform 방법으로 Sharp를 설치 
cd src
rm -rf node_modules/sharp
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --arch=x64 --platform=linux sharp

echo '================ finish sharp ================ \n'

echo mkdir /dist in ...  $PWD

# Dist 폴더 생성
mkdir -p ../dist

# Deployment Package로 .zip 파일로 만들기
zip -FS -q -r ../dist/functions.zip *