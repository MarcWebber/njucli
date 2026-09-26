import { standardWebPlusParser } from "../parser-utils.js";
import { defineCampusSource } from "../source-definition.js";

export const academicAffairsSource = defineCampusSource({
  id: "academic-affairs",
  name: "南京大学本科生院",
  origin: "https://jw.nju.edu.cn",
  sections: [{ id: "notifications", name: "公告通知", path: "/ggtz/list.htm" }],
  parser: standardWebPlusParser,
});
