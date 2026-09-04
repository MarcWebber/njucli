import { standardWebPlusParser } from "../parser-utils.js";
import { defineCampusSource } from "../source-definition.js";

export const graduateAdmissionSource = defineCampusSource({
  id: "graduate-admission",
  name: "南京大学研究生招生网",
  origin: "https://yzb.nju.edu.cn",
  sections: [
    { id: "master", name: "硕士最新通知", path: "/47863/list.htm" },
    { id: "doctoral", name: "博士最新通知", path: "/47865/list.htm" },
  ],
  articlePathPattern: /^\/[0-9a-f]{2}\/[0-9a-f]{2}\/c\d+a\d+\/page\.htm$/i,
  parser: standardWebPlusParser,
});
