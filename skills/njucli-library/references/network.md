# 图书馆 HTTPS 配置

图书馆命令连接 `https://opac.nju.edu.cn`。2026-10-10 实测该站只发送叶子证书，Node.js 返回 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`；浏览器可以补齐证书链后访问。以下配置为 Node.js 提供站点证书的 DigiCert 官方中间证书，继续执行证书链、有效期和主机名校验。

## 配置步骤

在自己管理的目录保存官方证书：

```bash
mkdir -p ~/.config/njucli/certs
curl --fail --location \
  https://cacerts.digicert.com/DigiCertSecureSiteOVG2TLSCNRSA4096SHA2562022CA1.crt \
  --output ~/.config/njucli/certs/opac-issuer.crt
openssl x509 -inform DER \
  -in ~/.config/njucli/certs/opac-issuer.crt \
  -out ~/.config/njucli/certs/opac-issuer.pem
export NODE_EXTRA_CA_CERTS="$HOME/.config/njucli/certs/opac-issuer.pem"
node scripts/run.mjs library search "算法导论" --field title --format json
```

使用 XDG 配置目录时，将上面的路径替换为实际目录。已有 `NODE_EXTRA_CA_CERTS` 配置时，将两份 PEM 合并成一个证书文件，再指向合并文件。环境变量在启动 Node.js 进程前设置；MCP 客户端也应在服务进程环境中设置相同变量。

中间证书名称来自官网叶子证书的 CA Issuers 字段。本次使用 Node.js 自带根证书核对中间证书签发链，`openssl verify` 返回 `OK`，随后统一 CLI、独立 Skill 和 MCP 的 HTTPS 查询均通过。站点更新证书后，按新证书的官方签发链重新核对配置。
