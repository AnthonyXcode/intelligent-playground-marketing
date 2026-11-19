# 推廣電郵範本

| 檔案 | 用途 |
|---|---|
| `school-outreach.md` | 推廣電郵範本。第一行「主旨：」為電郵主旨；`**文字**` 為粗體；`![Ant-App](網址)` 為圖片（公司圖示，放在聲明之上） |
| `ant_app_icon.png` | 公司圖示原檔。電郵使用網上版本 https://www.antapp.ai/img/ant_app_icon.png |

## 發送前要替換

- `{{recipient_name}}`：例如「陳校長」「李主任」
- `{{school_name}}`：例如「葵涌循道中學」

## 用腳本發送（Gmail）

```sh
cd _build/mailer
./open-chrome.sh            # 第一次需在開啟的 Chrome 登入 Gmail
node send.mjs --to principal@school.edu.hk --name 陳校長 --school 葵涌循道中學
```

- 腳本會自動填入兩個欄位；如有欄位未填，會停止並提示。
- 電郵以格式化內容（粗體、圖示）發送，Gmail 會同時附上純文字版本，不支援 HTML 的電郵程式會顯示純文字。
- 不附 PPT，詳細資料請收件人瀏覽網站。`--test` 在主旨前加【測試】。

## 注意

- 根據《非應邀電子訊息條例》，推廣電郵須附取消訂閱方法；範本已加入「回覆『取消訂閱』」的說明。收到要求後須在 10 個工作天內停止發送，並保留取消訂閱名單。
- 資助金額及期限以教育局最新通函為準，發送前請再核對。
