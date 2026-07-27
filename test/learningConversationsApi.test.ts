import assert from "node:assert/strict";
import test from "node:test";

process.env.DEMO_EPHEMERAL_STORE = "true";

test("learning conversation API no longer creates market training conversations", async () => {
  const { POST } = await import("../src/app/api/learning-conversations/route");

  const response = await POST(new Request("http://localhost/api/learning-conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category: "market" }),
  }));

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.category, "product");
});

test("learning conversation API imports company intelligence as a simulated customer", async () => {
  const { POST } = await import("../src/app/api/learning-conversations/route");

  const response = await POST(new Request("http://localhost/api/learning-conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      category: "customer",
      companyName: "北京示例智能科技有限公司",
      companyUrl: "https://www.tianyancha.com/company/company-001",
      importSource: "market-intelligence",
    }),
  }));

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.category, "customer");
  assert.equal(body.title, "北京示例智能科技有限公司");
  assert.equal(body.targetCompanyName, "北京示例智能科技有限公司");
  assert.equal(body.targetCompanyUrl, "https://www.tianyancha.com/company/company-001");
  assert.equal(body.messages.length, 0);
  assert.match(body.targetCompanyPrompt, /企业链接：https:\/\/www\.tianyancha\.com\/company\/company-001/);
  assert.match(body.targetCompanyPrompt, /企业基本信息/);
  assert.match(body.targetCompanyPrompt, /语气刁钻直击痛点/);
});

test("learning conversation API labels newly created conversations by module", async () => {
  const { POST } = await import("../src/app/api/learning-conversations/route");

  const salesResponse = await POST(new Request("http://localhost/api/learning-conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category: "product" }),
  }));
  const customerResponse = await POST(new Request("http://localhost/api/learning-conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category: "customer" }),
  }));

  assert.equal(salesResponse.status, 201);
  assert.equal(customerResponse.status, 201);
  assert.equal((await salesResponse.json()).title, "新的销售培训对话");
  assert.equal((await customerResponse.json()).title, "新的模拟客户对话");
});
