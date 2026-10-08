# 校园公开信息接口

## 校园公开信息源

每个来源固定解析本站栏目和文章，跨站链接跳过。

| source | 官网 |
| --- | --- |
| `nju` | [南京大学](https://www.nju.edu.cn/) |
| `academic-affairs` | [本科生院](https://jw.nju.edu.cn/) |
| `graduate-school` | [研究生院](https://grawww.nju.edu.cn/) |
| `graduate-admission` | [研究生招生](https://yzb.nju.edu.cn/) |
| `itsc` | [信息化建设管理服务中心](https://itsc.nju.edu.cn/) |
| `youth-league` | [团委](https://tuanwei.nju.edu.cn/) |
| `research` | [科学技术处](https://scit.nju.edu.cn/) |
| `asset-management` | [资产管理处](https://zcc.nju.edu.cn/) |

`campus canteens [query]` 读取[后勤服务](https://www.nju.edu.cn/xyfw/hqfw.htm)中“膳食中心”表格，按名称筛选学生及民族食堂，返回名称和办公电话。

验证范围：七个可直连来源的列表和详情已通过实网查询；团委在验证网络返回 `VPN_REQUIRED`。食堂已核对页面表格，CLI 实网查询待验收。
