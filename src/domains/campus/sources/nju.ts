import { createHtmlSourceParser } from "../parser-utils.js";
import { defineCampusSource, firstPageOnly } from "../source-definition.js";

const parser = createHtmlSourceParser({
  list: {
    container: ".kxyj ul.flex",
    item: ":scope > li",
    link: "a.flex[href]",
    title: ".kxdt-r h3",
    titleRemove: "i",
    date: ".kxdt-l",
    readDate: (_$, item) => {
      const monthAndDay = item.find(".kxdt-l p").first().text().trim();
      const year = item.find(".kxdt-l span").first().text().trim();
      return `${year}-${monthAndDay}`;
    },
  },
  article: {
    title: ".new-cont > h2, .new-cont form > h2",
    date: ".cont-tit .ardate",
    publisher: ".cont-tit .arauthor",
    body: ".article .v_news_content",
  },
});

const firstPage = "https://www.nju.edu.cn/xww/zhxw.htm";

export const njuSource = defineCampusSource({
  id: "nju",
  name: "南京大学",
  origin: "https://www.nju.edu.cn",
  sections: [
    {
      id: "news",
      name: "南大新闻",
      path: "/xww/zhxw.htm",
      listUrl: (page) => firstPageOnly(firstPage, page),
    },
  ],
  articlePathPattern: /^\/info\/\d+\/\d+\.htm$/,
  parser,
});
