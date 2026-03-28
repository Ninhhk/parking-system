do not share this with anyonne
Thông tin cấu hình

Client ID:
f1cf098c-1ee8-471c-aea6-48dcfe4deb56

Api Key:
a92909fb-b63a-4c38-b853-6d4f067c5c1d

Checksum Key:
daa4b7d579efe7dc1520bf41d94bd53ef1514a34291cd3629c45dad0a3fa4726

Webhook url

Cách hoạt động payOS Checkout
payOS Checkout là một giao diện dựng sẵn, giúp giảm thời gian phát triển.

Luồng hoạt động
Bước 1: Khách hàng thực hiện mua hàng trên Website hoặc ứng dụng của merchant và lựa chọn thanh toán trực tuyến Napas 247 cho đơn hàng.
Bước 2: Website hoặc ứng dụng của merchant tiến hành gọi tạo link thanh toán, payOS sẽ kiểm tra dữ liệu và trả về kết quả chứa link thanh toán. Khi hệ thống của merchant nhận kết quả link thanh toán cần chuyển hướng khách hàng của bạn đến trang checkout của payOS bằng cách mở link thanh toán từ kết quả.
Bước 3: Khách hàng sử dụng ứng dụng ngân hàng để quét mã VietQR từ link thanh toán.
Bước 4: Giao dịch ghi nhận thành công tại ngân hàng, payOS sẽ trả kết quả thành công về returnUrl gồm: trạng thái, mã đơn hàng, mã link thanh toán, ... Từ kết quả nhận được trên returnUrl Website hoặc ứng dụng của merchant hiển thị giao diện thành công.
Bước 5: Sau khi có kết quả ở giao diện, đồng thời payOS sẽ gửi một kết quả với đầy đủ thông tin thanh toán tới Webhook của cửa hàng được thiết lập trên https://my.payos.vn, sau đó merchant cập nhật trạng thái đơn hàng phù hợp.
Ngân hàng người mua
Ngân hàng nhà bán
Server payOS
Server trang bán hàng
Ngân hàng người mua
Ngân hàng nhà bán
Server payOS
Server trang bán hàng
Người mua
Thanh toán một đơn hàng
1
Gọi API/v2/payment-requests
2
Tạo mã QR-Pay
3
Trả về QR-Pay cho đơn hàng
4
Trả về thông tin thanh toán
5
Mở QR-Pay thanh toán
6
Quét mã QR thanh toán trên trang
7
Thực hiện chuyển tiền
8
Cập nhật thanh toán mới
9
Hoàn tất thanh toán
10
Chuyển hướng đến trang thanh toán thành công
11
Người mua
Cách tích hợp payOS với hệ thống của Merchant
Code để tạo link thanh toán
Code xử lý returnUrl và cancelUrl để nhận thông báo kết quả Thanh toán và Huỷ đơn hàng trên giao diện.
Code webhook để nhận kết quả thanh toán của một đơn hàng.
Low-code
payOS Checkout với yêu cầu ít code và lựa chọn tốt nhất để tích hợp thanh toán bởi những tính năng có sẵn. Lựa chọn hiển thị giao diện Checkout:

Chuyển hướng đến trang payOS Checkout
Mở dialog giao diện thanh toán
Nhúng giao diện thanh toán vào website hoặc ứng dụng của bạn.

payOS Embedded Form
Frontend:

Backend:

Thiết lập Server
Cài đặt thư viện payOS cho NodeJS
npm install @payos/node
# hoặc
yarn add @payos/node

Khởi tạo đối tượng PayOS
Bạn cần khởi tạo đối tượng PayOS bằng Client ID, API Key và Checksum Key của kênh thanh toán mà bạn đã tạo trên trang payOS.

Tạo link thanh toán
Link thanh toán kiểm soát những gì khách hàng của bạn nhìn thấy trên trang thanh toán, chẳng hạn như Tên sản phẩm, số lượng đặt, số tiền cũng như số tài khoản thụ hưởng, tên ngân hàng.

Cung cấp returnUrl và cancelUrl
Chỉ định URL công khai cho trang thanh toán thành công và hủy thanh toán. Bạn cũng có thể xử lý cả trạng thái thành công và hủy với cùng một URL.

Chuyển hướng tới trang thanh toán
Sau khi tạo link thanh toán thành công, chuyển hướng khách hàng tới trang thanh toán trả về trong phản hồi.

Xây dựng giao diện
Cài đặt thư viện payos-checkout bằng link cdn
<script src="https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js"></script>


Thêm nút tạo link thanh toán và thêm div nhúng giao diện thanh toán
Thêm 1 nút bấm tạo link thanh toán trên trang xem thông tin đơn hàng để gọi API tạo link thanh toán và 1 div có trường id riêng biệt được sử dụng để nhúng giao diện thanh toán trên trang web

Khởi tạo config cho hook usePayOS
Có 3 trường bắt buộc phải khởi tạo:

RETURN_URL: url dẫn đến trang web khi thanh toán thành công.
ELEMENT_ID: id của 1 component mà bạn muốn nhúng giao diện thanh toán của payOS vào
CHECKOUT_URL: đường link dẫn đến giao diện thanh toán sẽ được nhúng vào trang web của bạn
Vì thực hiện giao diện thanh toán nhúng nên ta sẽ sử dụng thêm các property như sau:

embedded: true để sử dụng giao diện nhúng
onSuccess(event): gọi hàm bạn truyền vào nếu như người dùng thực hiện thanh toán thành công
Thông tin chi tiết hơn tại: payos-checkout

Thực hiện gọi hook usePayOS với config đã khởi tạo trước đó
usePayOS hook trả về 2 hàm open() và exit().

Chạy thử
Chạy server của bạn và truy cập vào http://localhost:3030 để bắt đầu tạo link thanh toán.

npm start

server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { PayOS } = require('@payos/node');

const app = express();
dotenv.config();
const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post('/create-embedded-payment-link', async (req, res) => {
  const YOUR_DOMAIN = `http://localhost:3000/`;
  const body = {
    orderCode: Number(String(Date.now()).slice(-6)),
    amount: 10000,
    description: 'Thanh toan don hang',
    returnUrl: `${YOUR_DOMAIN}`,
    cancelUrl: `${YOUR_DOMAIN}`,
  };

  try {
    const paymentLinkResponse = await payOS.paymentRequests.create(body);

    res.send(paymentLinkResponse);
  } catch (error) {
    console.error(error);
    res.send('Something went error');
  }
});

app.listen(3030, function () {
  console.log(`Server is listening on port 3030`);
});

index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tạo Link thanh toán</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body style="display: flex">
    <div style="padding-top: 10px; display: flex; flex-direction: column">
      <div
        style="border: 2px solid blue; border-radius: 10px; overflow: hidden"
      >
        <div id="content-container" style="padding: 10px">
          <p><strong>Tên sản phẩm:</strong> Mì tôm Hảo Hảo ly</p>
          <p><strong>Giá tiền:</strong> 2000 VNĐ</p>
          <p><strong>Số lượng:</strong> 1</p>
        </div>
        <div id="button-container">
          <button
            type="submit"
            id="create-payment-link-btn"
            style="
              width: 100%;
              background-color: blue;
              color: white;
              border: none;
              padding: 10px;
              font-size: 15px;
            "
          >
            Tạo Link thanh toán
          </button>
        </div>
      </div>
      <div id="embeded-payment-container" style="height: 350px"></div>
    </div>
  </body>
</html>
<script src="https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js"></script>
<script src="index.js"></script>

index.js
/* eslint-disable no-undef */
const buttonContainer = document.getElementById("button-container");
const contentContainer = document.getElementById("content-container");
let isOpen = false;
let config = {
  RETURN_URL: window.location.href,
  ELEMENT_ID: "embeded-payment-container",
  CHECKOUT_URL: "",
  embedded: true,
  onSuccess: (event) => {
    contentContainer.innerHTML = `
        <div style="padding-top: 20px; padding-bottom:20px">
            Thanh toan thanh cong
        </div>
    `;
    buttonContainer.innerHTML = `
        <button
            type="submit"
            id="create-payment-link-btn"
            style="
            width: 100%;
            background-color: blue;
            color: white;
            border: none;
            padding: 10px;
            font-size: 15px;
            "
        >
            Quay lại trang thanh toán
        </button>
    `;
  },
};
buttonContainer.addEventListener("click", async (event) => {
  if (isOpen) {
    const { exit } = PayOSCheckout.usePayOS(config);
    exit();
    contentContainer.innerHTML = `
        <p><strong>Tên sản phẩm:</strong> Mì tôm Hảo Hảo ly</p>
        <p><strong>Giá tiền:</strong> 2000 VNĐ</p>
        <p><strong>Số lượng:</strong> 1</p>
    `;
  } else {
    const checkoutUrl = await getPaymentLink();
    config = {
      ...config,
      CHECKOUT_URL: checkoutUrl,
    };
    const { open } = PayOSCheckout.usePayOS(config);
    open();
  }
  isOpen = !isOpen;
  changeButton();
});

const getPaymentLink = async () => {
  const response = await fetch(
    "http://localhost:3030/create-embedded-payment-link",
    {
      method: "POST",
    }
  );
  if (!response.ok) {
    console.log("server doesn't response!");
  }
  const result = await response.json();
  return result.checkoutUrl;
};

const changeButton = () => {
  if (isOpen) {
    buttonContainer.innerHTML = `
        <button
            type="submit"
            id="create-payment-link-btn"
            style="
            width: 100%;
            background-color: gray;
            color: white;
            border: none;
            padding: 10px;
            font-size: 15px;
            "
        >
            Đóng link thanh toán
        </button>
      `;
  } else {
    buttonContainer.innerHTML = `
        <button
            type="submit"
            id="create-payment-link-btn"
            style="
                width: 100%;
                background-color: blue;
                color: white;
                border: none;
                padding: 10px;
                font-size: 15px;
            "
            >
            Tạo Link thanh toán
        </button> 
    `;
  }
};
Webhook thông tin thanh toán
Webhook thanh toán
Event
Webhook nhận thông tin thanh toán
redocly logoAPI docs by Redocly
payOS Payment Webhook API (latest)
payOS support: support@payos.vn
URL: https://payos.vn
Terms of Service
Webhook API cho hệ thống thanh toán payOS.

Trước khi bắt đầu
Bạn đã tạo một tài khoản https://my.payos.vn.
Bạn đã xác thực một doanh nghiệp hoặc cá nhân trên https://my.payos.vn, xem hướng dẫn
Bạn đã tạo một kênh thanh toán, xem hướng dẫn.
Môi trường
Production: https://api-merchant.payos.vn
Đăng ký chương trình đối tác tích hợp payOS Tại đây

Webhook thanh toán
Webhook thanh toán

Webhook nhận thông tin thanh toán Webhook
Webhook của cửa hàng dùng để nhận dữ liệu thanh toán từ payOS, Dữ liệu mẫu

Request Body schema: application/json
code
required
string
Mã lỗi

desc
required
string
Thông tin lỗi

success
required
boolean
data
required
object
signature
required
string
Chữ kí để kiểm tra thông tin, chi tiết dữ liệu mẫu

Responses
200 Phản hồi trạng thái mã 2XX để xác nhận webhook gửi thành công
Request samples
Payload
Content type
application/json

Copy
Expand allCollapse all
{
"code": "00",
"desc": "success",
"success": true,
"data": {
"orderCode": 123,
"amount": 3000,
"description": "VQRIO123",
"accountNumber": "12345678",
"reference": "TF230204212323",
"transactionDateTime": "2023-02-04 18:25:00",
"currency": "VND",
"paymentLinkId": "124c33293c43417ab7879e14c8d9eb18",
"code": "00",
"desc": "Thành công",
"counterAccountBankId": "",
"counterAccountBankName": "",
"counterAccountName": "",
"counterAccountNumber": "",
"virtualAccountName": "",
"virtualAccountNumber": ""
},
"signature": "8d8640d802576397a1ce45ebda7f835055768ac7ad2e0bfb77f9b8f12cca4c7f"
}

Return URL
Sau khi thực hiện thanh toán trình duyệt sẽ điều hướng về trang mà người dùng đã khai báo ở returnUrl đã được khai báo trong API tạo link thanh toán. Ngược lại, nếu người dùng hủy thanh toán, trình duyệt sẽ điều hướng về cancelUrl.

returnUrl và cancelUrl sẽ được gắn các query params chứa thông tin thanh toán phục vụ cho việc xử lý ở phía giao diện người dùng.

Ví dụ về Return URL:
thông tin
https://your-website.com/return-url/?code=00&id=2e4acf1083304877bf1a8c108b30cccd&cancel=true&status=CANCELLED&orderCode=803347

Mô tả dữ liệu trả về qua Query Params:
Tên	Giá trị	Mô tả	Tập giá trị
code	00	Mã lỗi	
00 - Thành công
01 - Invalid Params
id	2e4acf1083304877bf1a8c108b30cccd	Payment Link Id	string
cancel	true	Trạng thái hủy	
true - Đã hủy thanh toán
false - Đã thanh toán hoặc chờ thanh toán
status	CANCELLED	Trạng thái thanh toán	
PAID - Đã thanh toán
PENDING - Chờ thanh toán
PROCESSING - Đang xử lý
CANCELLED - Đã hủy
orderCode	803347	Mã đơn hàng	number

SDKs
Các thư viện và script giúp tích hợp nhanh payOS vào hệ thống của merchant.

Server-side SDKs
Node
Python
.NET Core
PHP
Golang
Cài đặt với npm

npm install @payos/node --save

Cài đặt với yarn

yarn add @payos/node

Web SDKs
payOS react payOS JS
payOS cung cấp script-js hỗ trợ mở link thanh toán

Javascript
ReactJS
npm install payos-checkout

payOS Checkout Script JS
payOS cung cấp script-js hỗ trợ mở link thanh toán

Giới thiệu
Đây là thư viện dùng để hỗ trợ mở Pop up thanh toán trên trang web của bạn.

Javascript
ReactJS
Cài đặt
Khai báo lệnh khởi tạo payOS ở mỗi trang trên trang web của bạn. Nó phải luôn được tải trực tiếp từ https://cdn.payos.vn, thay vì được đưa vào một gói cài đặt hoặc tự lưu trữ. Không giống như các SDK khác của payOS, SDK web JavaScript không được lập phiên bản; cdn.payos.vn sẽ tự động cung cấp SDK mới nhất hiện có.

<script src='https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js'></script>

Chỉ thị CSP
Nếu bạn đang sử dụng Chính sách bảo mật nội dung (CSP), hãy sử dụng các lệnh sau để cho phép lưu lượng truy cập Liên kết:

  default-src https://cdn.payos.vn/
  script-src https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js
  frame-src https://pay.payos.vn/ https://next.pay.payos.vn/
  connect-src https://payos.vn/

Khởi tạo
let payOSConfig: PayOSConfig = {
  RETURN_URL: "", // required
  ELEMENT_ID: "", // required
  CHECKOUT_URL: "", // required
  embedded: true, // Nếu dùng giao diện nhúng
  onSuccess: (event: any) => {
    //TODO: Hành động sau khi người dùng thanh toán đơn hàng thành công
  },
  onCancel: (event: any) => {
    //TODO: Hành động sau khi người dùng Hủy đơn hàng
  },
  onExit: (event: any) => {
    //TODO: Hành động sau khi người dùng tắt Pop up
  },
};

Mô tả các thành phần của PayOSConfig:

* RETURN_URL

(String): Đây là đường dẫn tới trang web của bạn khi đơn hàng được thanh toán thành công

* ELEMENT_ID

(String): Đây là #id của thẻ div sẽ chứa iframe thanh toán

* CHECKOUT_URL

(String): Đây là đường dẫn tới trang thanh toán mà chúng tôi sẽ mở nó bằng iframe

embedded (boolean): false nếu dùng pop up thanh toán, true nếu dùng giao diện nhúng.

onSuccess (Callback): Sẽ được gọi sau khi đơn hàng được thanh toán thành công.

onCancel (Callback): Sẽ được gọi sau khi người dùng "Hủy thanh toán".

onExit (Callback): Sẽ được gọi sau khi người dùng bấm thoát khỏi Pop Up thanh toán (Bấm biểu tượng "X" trên iframe).

Lưu ý
RETURN_URL phải trùng với đường dẫn hiển thị iframe thanh toán.

Mô tả các thuộc tính có trong event:

loading: Có giá trị false nếu luồng thực thi đã kết thúc.
code: Mã code phản hồi. Các giá trị của thuộc tính:
00: SUCCESS
01: FAILED
02: INVALID_PARAM
id: paymentLinkId. Ví dụ: cb62d25884c7463cbabd2997b4c03af9
cancel: Có giá trị true khi huỷ đơn hàng và false khi thanh toán đơn hàng
orderCode: Mã đơn hàng
status: Có giá trị CANCELLED hoặc PAID, mô tả cho trạng thái đơn hàng đã bị huỷ hay đã được thanh toán
{
  loading: boolean;
  code: string;
  id: string;
  cancel: string;
  orderCode: number;
  status: string;
}

Cách sử dụng
PayOSCheckout.usePayOS chấp nhận một đối số là Object có kiểu dữ liệu PayOSConfig như đã mô tả ở phần trên, và trả về một Object gồm 2 hàm có tên là open và exit.

const { open, exit } = PayOSCheckout.usePayOS(payOSConfig);

open();

Thông tin về các hàm:

open() (void): Sau khi hàm này được thực thi, Pop up hoặc giao diện nhúng sẽ được thêm vào trang web.
exit() (void): Sau khi hàm này được thực thi, Pop up sẽ được tắt ngay lập tức

NodeJS SDK
thông tin
Code demo: https://github.com/payOSHQ/payos-demo-nodejs

Tài liệu đầy đủ
Để biết thêm chi tiết về các phương thức, tham số và tính năng nâng cao (pagination, error handling, logging, v.v.), vui lòng xem GitHub Repository.

Cài đặt
Cài đặt gói @payos/node thông qua npm hoặc yarn:

npm install @payos/node
# hoặc
yarn add @payos/node

Khởi tạo
Khởi tạo đối tượng PayOS với Client ID, API Key và Checksum Key từ kênh thanh toán:

import { PayOS } from '@payos/node';

const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

Tạo link thanh toán
Sử dụng phương thức paymentRequests.create() để tạo link thanh toán:

const paymentData = {
  orderCode: 123456,
  amount: 50000,
  description: 'Thanh toán đơn hàng',
  items: [
    {
      name: 'Sản phẩm A',
      quantity: 1,
      price: 50000,
    },
  ],
  cancelUrl: 'https://your-domain.com/cancel',
  returnUrl: 'https://your-domain.com/success',
};

const paymentLink = await payOS.paymentRequests.create(paymentData);
console.log(paymentLink.checkoutUrl);

Xác minh webhook
Sử dụng phương thức webhooks.verify() để xác thực dữ liệu webhook:

app.post('/webhook', (req, res) => {
  try {
    const webhookData = payOS.webhooks.verify(req.body);
    console.log('Thanh toán thành công:', webhookData);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook không hợp lệ:', error);
    res.status(400).send('Invalid webhook');
  }
});

Tạo payout
Sử dụng phương thức payouts.batch.create() để tạo payout theo lô:

const referenceId = `payout_${Date.now()}`;
const payoutBatch = await payOS.payouts.batch.create({
  referenceId,
  category: ['salary'],
  validateDestination: true,
  payouts: [
    {
      referenceId: `${referenceId}_1`,
      amount: 2000,
      description: 'Thanh toán lương',
      toBin: '970422',
      toAccountNumber: '0123456789',
    },
    {
      referenceId: `${referenceId}_2`,
      amount: 3000,
      description: 'Thanh toán thưởng',
      toBin: '970422',
      toAccountNumber: '0987654321',
    },
  ],
});

console.log('Payout ID:', payoutBatch.id);

# Các câu hỏi thường gặp

Các câu hỏi thường gặp khi tích hợp payOS

## 1. `signature` là gì và khi nào dùng đến?[​](#1-signature-là-gì-và-khi-nào-dùng-đến "Đường dẫn trực tiếp đến 1-signature-là-gì-và-khi-nào-dùng-đến")

* `signature` là một chuỗi ký tự dùng để kiểm tra tính toàn vẹn dữ liệu trong việc truyền dữ liệu giữa hệ thống của bạn và payOS. Được tạo ra khi kết hợp `checksum_key` và các trường data tương ứng với mỗi API.

* Mỗi khi bạn nhận được dữ liệu từ payOS bạn nên kiểm tra `signature` để chắc chắn dữ liệu bạn nhận được đúng với thông tin mà hệ thống payOS trả về, [chi tiết](/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature.md#c%C3%A1ch-t%E1%BA%A1o-signature)

* Các trường hợp dùng đến:

  <!-- -->

  * [Tạo link thanh toán](/docs/api/.md#tag/payment-request/operation/payment-request)
  * [Nhận thông tin thanh toán](/docs/du-lieu-tra-ve/webhook.md)

## 2. Tại sao tôi bị lỗi `Mã kiểm tra(signature) không hợp lệ`?[​](#2-tại-sao-tôi-bị-lỗi-mã-kiểm-trasignature-không-hợp-lệ "Đường dẫn trực tiếp đến 2-tại-sao-tôi-bị-lỗi-mã-kiểm-trasignature-không-hợp-lệ")

* Kiểm tra các trường tạo `signature` đã đúng chưa, với API [tạo link thanh toán](/docs/api/.md#tag/payment-request/operation/payment-request) sẽ được tạo bằng 5 trường sau đây (amount, orderCode, description, returnUrl, cancelUrl).
* Kiểm tra lại dữ liệu của bạn có đang truyền ở `body` và dạng JSON.

## 3. Tại sao tôi nhập không đúng thông tin CCCD/CMND/MST?[​](#3-tại-sao-tôi-nhập-không-đúng-thông-tin-cccdcmndmst "Đường dẫn trực tiếp đến 3. Tại sao tôi nhập không đúng thông tin CCCD/CMND/MST?")

* Bạn truy cập trang <https://masothue.com> để kiểm tra thông tin CCCD, CMND và MST đã có chưa.
* Nếu có kết quả thì bạn quay lại payOS và dùng thông tin này để tiếp tục các bước [Xác thực doanh nghiệp](/docs/huong-dan-su-dung/xac-thuc-to-chuc.md)

## 4. Tại sao tôi chuyển khoản rồi nhưng không xác thực được?[​](#4-tại-sao-tôi-chuyển-khoản-rồi-nhưng-không-xác-thực-được "Đường dẫn trực tiếp đến 4. Tại sao tôi chuyển khoản rồi nhưng không xác thực được?")

* Nếu bạn chuyển khoản trong khung giờ từ 22h - 5h thì bạn vui lòng quay lại Xác thực vào sáng hôm sau(do từ hệ thống ngân hàng giao dịch chuyển trong khung giờ này được ghi nhận vào ngày hôm sau).
* Tên chủ tài khoản chuyển khoản phải trùng với tên mà bạn xác thực trước đó. [chi tiết](/docs/huong-dan-su-dung/xac-thuc-to-chuc.md#x%C3%A1c-th%E1%BB%B1c-t%E1%BB%95-ch%E1%BB%A9c-c%C3%A1-nh%C3%A2nh%E1%BB%99-kinh-doanh)
* Với tài khoản ngân hàng loại Doanh nghiệp có thể do tên doanh nghiệp trên hệ thống ngân hàng khác với tên trên Chi cục Thuế, với trường hợp này vui lòng liên hệ với <https://payos.vn> để được hỗ trợ.

## 5. Tại sao tôi không tạo được tài khoản trên payOS?[​](#5-tại-sao-tôi-không-tạo-được-tài-khoản-trên-payos "Đường dẫn trực tiếp đến 5. Tại sao tôi không tạo được tài khoản trên payOS?")

Bạn cần dùng tài khoản ngân hàng có tên tài khoản trùng với tên doanh nghiệp hoặc tên cá nhân/hộ kinh doanh đã xác thực Doanh nghiệp trước đó để thêm tài khoản.

## 6. Tại sao số tài khoản trên `link thanh toán` lại không giống với số tài khoản của tôi?[​](#6-tại-sao-số-tài-khoản-trên-link-thanh-toán-lại-không-giống-với-số-tài-khoản-của-tôi "Đường dẫn trực tiếp đến 6-tại-sao-số-tài-khoản-trên-link-thanh-toán-lại-không-giống-với-số-tài-khoản-của-tôi")

Nếu bạn tạo `link thanh toán` với tài khoản ngân hàng liên kết bằng [VietQR Pro](https://payos.vn/vietqr-pro/) thì số tài khoản hiển thị sẽ là Số tài khoản ảo, [xem thông tin về tài khoản ảo](https://payos.vn/tai-khoan-ao/). Một Tài khoản ảo sẽ tương ứng với một đơn hàng và số tiền, chuyển sai Số tài khoản ảo thì đơn hàng đó sẽ không được xác nhận.

## 7. Khách hàng của bạn chuyển sai số tiền?[​](#7-khách-hàng-của-bạn-chuyển-sai-số-tiền "Đường dẫn trực tiếp đến 7. Khách hàng của bạn chuyển sai số tiền?")

Với liên kết ngân hàng bằng [VietQR Pro](https://payos.vn/vietqr-pro/)

* Chuyển khoản sẽ bị từ chối ở màn hình chuyển khoản của ngân hàng.
* Khách hàng của bạn chuyển thành công thì sau đó hệ thống ngân hàng sẽ hoàn tiền lại vào tài khoản của khách hàng của bạn và đồng thời đơn hàng sẽ không được xác nhận.
payOS Node.js Library
Version Downloads

The payOS Node library provides convenient access to the payOS Merchant API from applications written in JavaScript or Typescript.

To learn how to use payOS Merchant API, checkout our API Reference and Documentation. We also have some examples in Examples.

Requirements
Node 20 or higher.

Installation
npm install @payos/node
Important

If update from v1, check Migration guide for detail migration.

Usage
Basic usage
First you need initialize the client to interacting with payOS Merchant API.

import { PayOS } from '@payos/node';
// or
const { PayOS } = require('@payos/node');

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  // ... other options
});
Then you can interact with payOS Merchant API, example create a payment link using paymentRequests.create().

const paymentLink = await payos.paymentRequests.create({
  orderCode: 123,
  amount: 2000,
  description: 'payment',
  returnUrl: 'https://your-url.com',
  cancelUrl: 'https://your-url.com',
});
Webhook verification
You can register an endpoint to receive the payment webhook.

const confirmResult = await payos.webhooks.confirm('https://your-url.com/payos-webhook');
Then using webhooks.verify() to verify and receive webhook data.

const webhookData = await payos.webhooks.verify({
  code: '00',
  desc: 'success',
  success: true,
  data: {
    orderCode: 123,
    amount: 3000,
    description: 'VQRIO123',
    accountNumber: '12345678',
    reference: 'TF230204212323',
    transactionDateTime: '2023-02-04 18:25:00',
    currency: 'VND',
    paymentLinkId: '124c33293c43417ab7879e14c8d9eb18',
    code: '00',
    desc: 'Thành công',
    counterAccountBankId: '',
    counterAccountBankName: '',
    counterAccountName: '',
    counterAccountNumber: '',
    virtualAccountName: '',
    virtualAccountNumber: '',
  },
  signature: '8d8640d802576397a1ce45ebda7f835055768ac7ad2e0bfb77f9b8f12cca4c7f',
});
For more information about webhooks, see the API doc.

Handling errors
When the API return a non-success status code (i.e, 4xx or 5xx response) or non-success code data (any code except '00'), a class APIError or its subclass will be thrown:

payos
  .get({
    path: '/not-found',
  })
  .catch((err) => {
    if (err instanceof APIError) {
      console.log(err.name); // NotFoundError
      console.log(err.message); // HTTP 404, {}
      console.log(err.status); // 404
      console.log(err.headers); // {server: "nginx",...}
      console.log(err.code); // undefined
      console.log(err.desc); // undefined
    } else {
      throw err;
    }
  });
Auto pagination
List method in the payOS Merchant API are paginated, You can use the for await ... of syntax to iterate though items across all pages:

const allPayouts = [];
const payoutPage = await payos.payouts.list({ limit: 3 });
for await (const payout of payoutPage) {
  allPayouts.push(payout);
}
console.log(allPayouts);
// or
const payouts = await payoutPage.toArray();
console.log(payouts);
Or you can request single page at a time:

let page = await payos.payouts.list({
  limit: 3,
});
for (const payout of page.data) {
  console.log(payout);
}

while (page.hasNextPage()) {
  page = await page.getNextPage();
}
Advanced usage
Custom configuration
You can customize the PayOS client with various options:

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  partnerCode: process.env.PAYOS_PARTNER_CODE, // Optional partner code
  baseURL: 'https://api-merchant.payos.vn', // Custom base URL
  timeout: 30000, // Request timeout in milliseconds (default: 60000)
  maxRetries: 3, // Maximum retry attempts (default: 2)
  logLevel: 'info', // Log level: 'off', 'error', 'warn', 'info', 'debug'
  logger: console, // Custom logger implementation
  fetchOptions: {
    // Additional fetch options
    headers: {
      'Custom-Header': 'value',
    },
  },
});
Custom fetch implementation
You can provide a custom fetch implementation:

import fetch from 'node-fetch'; // or any other fetch implementation

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  fetch: fetch as any, // Custom fetch function
});
Request-level options
You can override client-level settings for individual requests:

const paymentLink = await payos.paymentRequests.create(
  {
    orderCode: 123,
    amount: 2000,
    description: 'payment',
    returnUrl: 'https://your-url.com',
    cancelUrl: 'https://your-url.com',
  },
  {
    maxRetries: 5, // Override default max retries
    timeout: 10000, // Override default timeout
    signal: abortController.signal, // AbortSignal for request cancellation
  },
);
Logging and debugging
The log level can be configured in two ways:

Via the PAYOS_LOG environment variable.
Using the logLevel client option (override the environment if set).
By default, this library logs to globalThis.console. You can also provide a custom logger. If your logger doesn't work, please open an issue.

import { createLogger } from 'winston';

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  logLevel: 'debug', // Enable debug logging
  logger: createLogger({
    level: 'debug',
    transports: [new transports.Console()],
  }),
});
Direct API access
For advanced use cases, you can make direct API calls:

// GET request
const response = await payos.get('/v2/payment-requests');

// POST request
const response = await payos.post('/v2/payment-requests', {
  body: {
    orderCode: 123,
    amount: 2000,
    description: 'payment',
    returnUrl: 'https://your-url.com',
    cancelUrl: 'https://your-url.com',
  },
});

// With custom options
const response = await payos.request({
  method: 'POST',
  path: '/v2/payment-requests',
  body: requestData,
  maxRetries: 3,
  timeout: 15000,
});
Signature
The signature can be manually created by PayOS.crypto:

// for create-payment-link signature
const signature = await payos.crypto.createSignatureOfPaymentRequest(data, payos.checksumKey);
// of
const signature = await payos.crypto.createSignatureFromObj(
  { amount, cancelUrl, description, orderCode, returnUrl },
  payos.checksumKey,
);

// for payment-requests and webhook signature
const signature = await payos.crypto.createSignatureFromObj(data, payos.checksumKey);

// for payouts signature
const signature = await payos.crypto.createSignature(payos.checksumKey, data);