export const OPAC_BASE_URL = "https://opac.nju.edu.cn";
export const OPAC_GROUP_CODE = "200027";
export const OPAC_LOGIN_URL = "https://authserver.nju.edu.cn/authserver/login?service="
  + encodeURIComponent("http://opac.nju.edu.cn:8081/CASSSO2/caslogin.jsp");

export interface BookRow {
  recordId: number;
  title: string;
  author: string | null;
  callNo: string[] | null;
  isbn: string | null;
}

export interface HoldingRow {
  callNo: string;
  libName: string;
  locationName: string;
  shelfNo: string | null;
  processType: string;
  processTypeCode: string;
  circAttr: string;
}

export interface LoanRow {
  title: string;
  normReturnDate: string;
}
