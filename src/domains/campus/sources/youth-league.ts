import { standardWebPlusParser } from "../parser-utils.js";
import { defineCampusSource } from "../source-definition.js";

export const youthLeagueSource = defineCampusSource({
  id: "youth-league",
  name: "共青团南京大学委员会",
  origin: "https://tuanwei.nju.edu.cn",
  sections: [{ id: "notifications", name: "公告通知", path: "/ggtz/list.htm" }],
  articlePathPattern: /^\/[0-9a-f]{2}\/[0-9a-f]{2}\/c\d+a\d+\/page\.htm$/i,
  parser: standardWebPlusParser,
});
