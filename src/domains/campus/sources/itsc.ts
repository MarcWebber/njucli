import { standardWebPlusParser } from "../parser-utils.js";
import { defineCampusSource } from "../source-definition.js";

export const itscSource = defineCampusSource({
  id: "itsc",
  name: "南京大学信息化建设管理服务中心",
  origin: "https://itsc.nju.edu.cn",
  sections: [{ id: "notifications", name: "通知公告", path: "/tzgg/list.htm" }],
  articlePathPattern: /^\/[0-9a-f]{2}\/[0-9a-f]{2}\/c\d+a\d+\/page\.htm$/i,
  parser: standardWebPlusParser,
});
