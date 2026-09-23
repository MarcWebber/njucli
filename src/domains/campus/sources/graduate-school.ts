import { createHtmlSourceParser } from "../parser-utils.js";
import { defineCampusSource } from "../source-definition.js";

const parser = createHtmlSourceParser({
  list: {
    container: ".col_news_list ul.news_list",
    item: "li.news",
    link: ".news_title a",
    date: ".news_date",
    next: ".wp_paging a.next[href]",
    readDate: (item) => {
      const monthAndDay = item.find(".news_year").first().text().trim();
      const year = item.find(".news_days").first().text().trim();
      return `${year}-${monthAndDay}`;
    },
  },
  article: {
    title: "h1.arti_title",
    date: ".arti_metas .arti_update",
    publisher: ".arti_metas .arti_publisher",
    body: ".wp_articlecontent",
  },
});

export const graduateSchoolSource = defineCampusSource({
  id: "graduate-school",
  name: "南京大学研究生院",
  origin: "https://grawww.nju.edu.cn",
  sections: [{ id: "notifications", name: "动态通知", path: "/905/list.htm" }],
  articlePathPattern: /^\/[0-9a-f]{2}\/[0-9a-f]{2}\/c\d+a\d+\/page\.htm$/i,
  parser,
});
