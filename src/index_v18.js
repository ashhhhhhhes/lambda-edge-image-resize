"use strict";

// ❶ 필수 모듈
const querystring = require("querystring"); // Don't install.
const { S3Client, GetObjectAclCommand } = require("@aws-sdk/client-s3"); // aws-sdk v3로 변경 (Dont' install.)
const Sharp = require("sharp");

// ❷ S3 클라이언트, 버킷명 설정
const client = new S3Client({
  region: "ap-northeast-2",
});

// ❷-1. 버킷명 버킷명이 틀리면 오류가 발생할 수 있습니다.
const BUCKET = "lo-gos-test";

/**
 * 포맷 타입 PNG 여부
 * @param {*} format
 * @returns boolean
 */
const isPng = (format) => {
  return format === "png";
};

/**
 * 포맷 타입 GIF 여부
 * @param {*} format
 * @returns boolean
 */
const isGif = (format) => {
  return format === "gif";
};

/**
 * 클라이언트에 반환할 이미지 포맷 생성 함수
 * @param {*} changeFormat 변경할 이미지포맷
 * @param {*} extension 현재 파일 확장자명
 * @returns
 */
function initFormat(changeFormat, extension) {
  let result = changeFormat || extension;

  // jpg to jpeg
  result = result === "jpg" ? "jpeg" : result;

  // png to webp
  result = isPng(result) ? "jpeg" : result;

  return result;
}

/**
 * 이미지 높이 세팅 함수
 * @param {*} metaHeight 원본 이미지 높이
 * @param {*} paramsHeight 변경할 이미지 높이
 * @returns
 */
function initHeight(metaHeight, paramsHeight) {
  return paramsHeight ? Math.min(metaHeight, parseInt(paramsHeight, 10)) : null;
}

/**
 * 이미지 넓이 세팅 함수
 * @param {*} metaWidth 원본 이미지 높이
 * @param {*} paramsWidth 변경할 이미지 넓이
 * @returns
 */
function initWidth(metaWidth, paramsWidth) {
  return paramsWidth ? Math.min(metaWidth, parseInt(paramsWidth, 10)) : null;
}

/**
 * 포맷에 따른 품질 설정
 * @param {*} format 포맷
 * @param {*} quality 품질
 * @returns
 */
const getQuality = (format, quality) => {
  if (isPng(format)) {
    return 100;
  }

  return parseInt(quality, 10) || null;
};

exports.handler = async (event, context, callback) => {
  const { request, response } = event.Records[0].cf;

  // Parameters are w, h, f, q and indicate width, height, format and quality.
  const params = querystring.parse(request.querystring);

  // Required width or height value.
  if (!params.w && !params.h) {
    return callback(null, response);
  }

  // Extract name and format.
  const { uri } = request;
  const [, imageName, extension] = uri.match(/\/?(.*)\.(.*)/);

  if (isGif(extension)) {
    // change content-type to image/gif
    response.headers["content-type"] = [
      {
        key: "Content-Type",
        value: `image/gif`,
      },
    ];

    return callback(null, response);
  }

  // Init variables
  let format;
  let s3Object;
  let resizedImage;

  try {
    console.log(
      "Bucket !! :::",
      BUCKET,
      decodeURI(imageName + "." + extension)
    );
    const command = await new GetObjectAclCommand({
      Bucket: BUCKET,
      Key: decodeURI(imageName + "." + extension),
    });

    s3Object = await client.send(command);
  } catch (error) {
    console.error("S3.getObject: ", error);
    return callback(error);
  }

  const origintLength = s3Object.ContentLength;

  console.log(origintLength, "origintLength");

  try {
    const image = Sharp(s3Object.Body, {
      animated: isGif(extension),
      // failOn: "truncated", // 짤린(손상된) 이미지 오류 반환
      failOn: "none", // 모든 변환 실패 오류 반환 하지 않음
    });

    const meta = await image.metadata();

    // Init format.
    format = initFormat(params.f, extension);

    console.log(`format : ${format}`);

    // For AWS CloudWatch.
    console.log(`parmas: ${JSON.stringify(params)}`); // Cannot convert object to primitive value.
    console.log(`name: ${imageName}.${extension}`); // Favicon error, if name is `favicon.ico`.

    // Image crop logic
    // crop={width}x{height}
    // crop=100x100 = [100, 100]
    const crop = params.crop ? params.crop.split("x") : null;

    // crop
    if (crop && !isGif(extension)) {
      const top = parseInt(crop[0], 10);
      const cropHeight = parseInt(crop[1], 10);

      image
        .extract({
          left: 0,
          top: top,
          width: meta.width,
          height: cropHeight,
          quality: getQuality(format, params.q),
        })
        .resize({
          width: initWidth(meta.width, params.w),
          height: initHeight(meta.height, params.h),
        });
    } else {
      image.rotate().resize({
        width: initWidth(meta.width, params.w),
        height: initHeight(meta.height, params.h),
      });
    }

    if (isPng(params.f)) {
      image.jpeg({
        // Sharp는 이미지 포맷에 따라서 품질(quality)의 기본값이 다릅니다.
        quality: getQuality(format, params.q),
        chromaSubsampling: "4:4:4",
        mozjpeg: true,
      });
    } else {
      image.toFormat(format, {
        // Sharp는 이미지 포맷에 따라서 품질(quality)의 기본값이 다릅니다.
        quality: getQuality(format, params.q),
      });
    }

    resizedImage = await image.toBuffer();
  } catch (error) {
    console.error("Sharp: ", error);
    return callback(error);
  }

  const resizedImageByteLength = Buffer.byteLength(resizedImage, "base64");

  console.log("resized byteLength: ", resizedImageByteLength);

  // `response.body`가 변경된 경우 1MB까지만 허용됩니다.
  if (resizedImageByteLength >= 1 * 1024 * 1024) {
    return callback(null, response);
  }

  response.status = 200;
  response.body = resizedImage.toString("base64");
  response.bodyEncoding = "base64";
  response.headers["content-type"] = [
    {
      key: "Content-Type",
      value: `image/${format}`,
    },
  ];

  // cahce 만료 시간 설정
  response.headers["cache-control"] = [
    { key: "Cache-Control", value: "public, max-age=86400" },
  ];

  return callback(null, response);
};
