import { createHtmlSourceParser } from "../parser-utils.js";
import { defineCampusSource } from "../source-definition.js";

const parser = createHtmlSourceParser({
  list: {
    container: "ul.wp_article_list",
    item: "li.list_item",
    link: ".Article_Title a",
    date: ".Article_PublishDate",
    next: ".wp_paging a.next[href]",
  },
  article: {
    title: "h1.arti-title",
    date: ".arti-metas .arti-update",
    body: ".wp_articlecontent",
  },
});

export const researchSource = defineCampusSource({
  id: "research",
  name: "南京大学科学技术研究院",
  origin: "https://scit.nju.edu.cn",
  sections: [{ id: "notifications", name: "通知公告", path: "/10916/listm.htm" }],
  parser,
});
