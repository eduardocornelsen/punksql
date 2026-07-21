// dbt Missions — the Analytics Engineering track (TDD §4.4 archetypes).
// Each mission ships a seed VFS (starter project) and a solution VFS the
// grader runs to derive expected output. Graded on REAL materialized rows,
// not string-matching — any correct SQL passes (TDD §4.3).

const PROJECT_YML = `name: punksql_missions
version: '1.0.0'
config-version: 2

models:
  punksql_missions:
    staging:
      +materialized: view
    mart:
      +materialized: table
`;

const SOURCES_YML = `version: 2

sources:
  - name: raw
    description: Raw tables in the sandbox database
    tables:
      - name: orders
      - name: customers
      - name: products
      - name: order_items
      - name: sales
        identifier: raw_sales
`;

const STG_PRODUCTS_SQL = `{{ config(materialized='view') }}

select
  id as product_id,
  name,
  category,
  price,
  stock
from {{ source('raw', 'products') }}
`;

const STG_ORDER_ITEMS_SQL = `{{ config(materialized='view') }}

select
  id as order_item_id,
  order_id,
  product_id,
  quantity,
  unit_price
from {{ source('raw', 'order_items') }}
`;

const STG_ORDERS_SQL = `{{ config(materialized='view') }}

select
  id as order_id,
  customer_id,
  cast(total_amount as real) as amount,
  status
from {{ source('raw', 'orders') }}
`;

const STG_CUSTOMERS_SQL = `{{ config(materialized='view') }}

select
  id as customer_id,
  name,
  country
from {{ source('raw', 'customers') }}
`;

export const DBT_TUTORIAL = {
  id: "tut",
  xp: 20,
  title_en: "your first dbt run",
  title_pt: "seu primeiro dbt run",
  steps: [
    {
      t_en: "WHAT IS THIS?", t_pt: "O QUE É ISSO?",
      b_en: "The dbt lab is a virtual dbt project.\n\nModels are SELECT statements in\nmodels/**/*.sql. dbt turns each one\ninto a real view or table, in\ndependency order.\n\nTap ☰ to browse the project files.",
      b_pt: "O dbt lab é um projeto dbt virtual.\n\nModels são SELECTs em models/**/*.sql.\nO dbt transforma cada um em uma view\nou tabela real, em ordem de dependência.\n\nToque em ☰ para ver os arquivos.",
    },
    {
      t_en: "RUN THE PIPELINE", t_pt: "RODE O PIPELINE",
      b_en: "Tap [ run ] in the command bar.\n\nWatch the LOG panel: each model\nmaterializes for real — stg_* become\nviews, fct_revenue becomes a table.\n\nThe order comes from {{ ref() }}:\ndbt builds upstream models first.",
      b_pt: "Toque em [ run ] na barra de comandos.\n\nVeja o painel LOG: cada model\nmaterializa de verdade — stg_* viram\nviews, fct_revenue vira tabela.\n\nA ordem vem do {{ ref() }}:\no dbt constrói upstream primeiro.",
    },
    {
      t_en: "QUERY YOUR MODELS", t_pt: "CONSULTE SEUS MODELS",
      b_en: "Open a model and check the panels:\n\n  DATA  → preview its rows\n  SQL   → the compiled SQL (Jinja\n          rendered to plain SELECT)\n  GRAPH → its place in the DAG\n\nModels are also queryable in the\nSHELL tab — they're real relations.",
      b_pt: "Abra um model e veja os painéis:\n\n  DATA  → preview das linhas\n  SQL   → SQL compilado (Jinja\n          virando SELECT puro)\n  GRAPH → posição no DAG\n\nModels também são consultáveis na\naba SHELL — são relações reais.",
    },
    {
      t_en: "TESTS CATCH BAD DATA", t_pt: "TESTES PEGAM DADOS RUINS",
      b_en: "Tap [ test ].\n\nTwo tests FAIL — that's intentional:\nraw_sales has a NULL unit_price and\nnegative quantities, and stg_sales\ndoesn't filter them out yet.\n\nThe TESTS panel shows each failure\nwith its failing-row count. Tap a\ntest to see the SQL it ran.",
      b_pt: "Toque em [ test ].\n\nDois testes FALHAM — é intencional:\nraw_sales tem unit_price NULL e\nquantidades negativas, e stg_sales\nainda não filtra essas linhas.\n\nO painel TESTS mostra cada falha.\nToque em um teste para ver o SQL.",
    },
    {
      t_en: "FIX THE MODEL", t_pt: "CONSERTE O MODEL",
      b_en: "Open models/staging/stg_sales.sql\nand add:\n\n  where unit_price is not null\n    and quantity > 0\n\nThen tap [ build ] (run + test).\nAll tests should go green.",
      b_pt: "Abra models/staging/stg_sales.sql\ne adicione:\n\n  where unit_price is not null\n    and quantity > 0\n\nToque em [ build ] (run + test).\nTodos os testes devem passar.",
    },
    {
      t_en: "READY FOR MISSIONS", t_pt: "PRONTO PARA MISSÕES",
      b_en: "That's the loop: model → run →\ntest → fix → green build.\n\nNow earn XP with graded missions —\neach one is checked against real\nmaterialized output, so any correct\nSQL passes. Good hunting.",
      b_pt: "Esse é o ciclo: model → run →\ntest → fix → build verde.\n\nAgora ganhe XP com as missões —\ncada uma é avaliada pelo output\nreal materializado. Boa caça.",
    },
  ],
};

export const DBT_MISSIONS = [
  {
    id: "m1", diff: "EASY", xp: 30,
    title: "stg_products",
    desc_en: "Build your first staging model. Create models/staging/stg_products.sql as a VIEW that selects from the raw.products source and renames/keeps exactly these columns: id → product_id, name, category, price, stock.",
    desc_pt: "Construa seu primeiro staging model. Crie models/staging/stg_products.sql como VIEW selecionando do source raw.products com exatamente estas colunas: id → product_id, name, category, price, stock.",
    hint: "{{ config(materialized='view') }}\nselect id as product_id, name, category, price, stock\nfrom {{ source('raw', 'products') }}",
    explanation_en: "Staging models are 1:1 with sources: rename, cast, nothing else. Using {{ source() }} (not the raw table name) is what puts the edge in the DAG.",
    explanation_pt: "Staging models são 1:1 com sources: renomear, converter tipos e nada mais. Usar {{ source() }} (não o nome bruto) é o que cria a aresta no DAG.",
    seed: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_products.sql": "-- your staging model here\n-- select from {{ source('raw', 'products') }}\n",
    },
    solution: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_products.sql": STG_PRODUCTS_SQL,
    },
    validate: {
      target: "stg_products",
      mustMaterialize: { stg_products: "view" },
      mustUseSource: ["raw.products"],
    },
  },
  {
    id: "m2", diff: "MED", xp: 50,
    title: "fct_category_revenue",
    desc_en: "Build a mart. Create models/mart/fct_category_revenue.sql as a TABLE that joins ref('stg_order_items') to ref('stg_products') on product_id, grouped by category, with columns: category, items_sold (sum of quantity), revenue (sum of quantity * unit_price, rounded to 2 decimals).",
    desc_pt: "Construa um mart. Crie models/mart/fct_category_revenue.sql como TABLE juntando ref('stg_order_items') com ref('stg_products') por product_id, agrupado por category, com colunas: category, items_sold (soma de quantity), revenue (soma de quantity * unit_price, arredondada em 2 casas).",
    hint: "select p.category,\n  sum(i.quantity) as items_sold,\n  round(sum(i.quantity * i.unit_price), 2) as revenue\nfrom {{ ref('stg_order_items') }} i\njoin {{ ref('stg_products') }} p on p.product_id = i.product_id\ngroup by p.category",
    explanation_en: "Marts aggregate staging models via ref(). The two ref() calls give dbt the DAG edges, so stg models always build before the mart.",
    explanation_pt: "Marts agregam staging models via ref(). Os dois ref() dão ao dbt as arestas do DAG, então os stg sempre constroem antes do mart.",
    seed: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_products.sql": STG_PRODUCTS_SQL,
      "models/staging/stg_order_items.sql": STG_ORDER_ITEMS_SQL,
      "models/mart/fct_category_revenue.sql": "-- join the two staging models, group by category\n",
    },
    solution: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_products.sql": STG_PRODUCTS_SQL,
      "models/staging/stg_order_items.sql": STG_ORDER_ITEMS_SQL,
      "models/mart/fct_category_revenue.sql": `select
  p.category,
  sum(i.quantity) as items_sold,
  round(sum(i.quantity * i.unit_price), 2) as revenue
from {{ ref('stg_order_items') }} i
join {{ ref('stg_products') }} p on p.product_id = i.product_id
group by p.category
`,
    },
    validate: {
      target: "fct_category_revenue",
      mustMaterialize: { fct_category_revenue: "table" },
      mustUseRef: ["stg_order_items", "stg_products"],
    },
  },
  {
    id: "m3", diff: "EASY", xp: 40,
    title: "add_schema_tests",
    desc_en: "The model is done — now guard it. In models/staging/schema.yml, add a not_null test AND a unique test to the customer_id column of stg_customers, then make sure they pass.",
    desc_pt: "O model está pronto — agora proteja-o. Em models/staging/schema.yml, adicione um teste not_null E um unique na coluna customer_id de stg_customers, e garanta que passem.",
    hint: "models:\n  - name: stg_customers\n    columns:\n      - name: customer_id\n        tests:\n          - not_null\n          - unique",
    explanation_en: "Generic tests are YAML, not SQL — dbt compiles each into an assertion query that returns failing rows. not_null + unique on the key is the minimum contract every staging model should carry.",
    explanation_pt: "Testes genéricos são YAML, não SQL — o dbt compila cada um em uma query de asserção. not_null + unique na chave é o contrato mínimo de todo staging model.",
    seed: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_customers.sql": STG_CUSTOMERS_SQL,
      "models/staging/schema.yml": `version: 2

models:
  - name: stg_customers
    description: One row per customer
    columns:
      - name: customer_id
      - name: country
`,
    },
    solution: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_customers.sql": STG_CUSTOMERS_SQL,
      "models/staging/schema.yml": `version: 2

models:
  - name: stg_customers
    description: One row per customer
    columns:
      - name: customer_id
        tests:
          - not_null
          - unique
      - name: country
`,
    },
    validate: {
      target: "stg_customers",
      mustPassTests: ["not_null_stg_customers_customer_id", "unique_stg_customers_customer_id"],
    },
  },
  {
    id: "m4", diff: "MED", xp: 50,
    title: "fix_failing_tests",
    desc_en: "stg_sales fails its tests: raw sales data has NULL prices and non-positive quantities. Edit models/staging/stg_sales.sql so it keeps only rows where unit_price is not null AND quantity > 0 — the declared tests must go green.",
    desc_pt: "stg_sales falha nos testes: os dados brutos têm preços NULL e quantidades não positivas. Edite models/staging/stg_sales.sql para manter apenas linhas com unit_price não nulo E quantity > 0 — os testes declarados devem passar.",
    hint: "Add to the model:\nwhere unit_price is not null\n  and quantity > 0",
    explanation_en: "This is the daily loop of analytics engineering: a test catches bad data, the model gains a cleaning rule, the build goes green. The test now guards against regressions forever.",
    explanation_pt: "Esse é o ciclo diário de analytics engineering: um teste pega dado ruim, o model ganha uma regra de limpeza, o build fica verde. O teste agora protege contra regressões para sempre.",
    seed: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_sales.sql": `{{ config(materialized='view') }}

select
  id as sale_id,
  product_id,
  quantity,
  unit_price,
  sale_date
from {{ source('raw', 'sales') }}
`,
      "models/staging/schema.yml": `version: 2

models:
  - name: stg_sales
    columns:
      - name: unit_price
        tests:
          - not_null
`,
    },
    solution: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_sales.sql": `{{ config(materialized='view') }}

select
  id as sale_id,
  product_id,
  quantity,
  unit_price,
  sale_date
from {{ source('raw', 'sales') }}
where unit_price is not null
  and quantity > 0
`,
      "models/staging/schema.yml": `version: 2

models:
  - name: stg_sales
    columns:
      - name: unit_price
        tests:
          - not_null
`,
    },
    validate: {
      target: "stg_sales",
      mustPassTests: ["not_null_stg_sales_unit_price"],
    },
  },
  {
    id: "m5", diff: "EASY", xp: 30,
    title: "fix_broken_ref",
    desc_en: "The pipeline is broken: dbt run fails with a compilation error. Find the bad {{ ref() }} in models/mart/fct_completed_revenue.sql and fix it so the project builds.",
    desc_pt: "O pipeline está quebrado: dbt run falha com erro de compilação. Encontre o {{ ref() }} errado em models/mart/fct_completed_revenue.sql e conserte para o projeto compilar.",
    hint: "Read the compile error in the LOG panel — the model name inside ref('...') must match an existing model file exactly.",
    explanation_en: "ref() errors are the most common dbt beginner failure. The error message names the missing model — debugging starts with reading the log, not the code.",
    explanation_pt: "Erros de ref() são a falha mais comum de iniciantes em dbt. A mensagem de erro dá o nome do model — a depuração começa lendo o log, não o código.",
    seed: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_orders.sql": STG_ORDERS_SQL,
      "models/mart/fct_completed_revenue.sql": `select
  status,
  round(sum(amount), 2) as revenue
from {{ ref('stg_order') }}
where status = 'completed'
group by status
`,
    },
    solution: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_orders.sql": STG_ORDERS_SQL,
      "models/mart/fct_completed_revenue.sql": `select
  status,
  round(sum(amount), 2) as revenue
from {{ ref('stg_orders') }}
where status = 'completed'
group by status
`,
    },
    validate: {
      target: "fct_completed_revenue",
      mustUseRef: ["stg_orders"],
    },
  },
  {
    id: "m6", diff: "MED", xp: 50,
    title: "ephemeral_intermediate",
    desc_en: "Create models/intermediate/int_electronics.sql materialized as EPHEMERAL that filters ref('stg_products') to category = 'Electronics'. Then create models/mart/fct_electronics_stock.sql as a TABLE that refs it, with columns: products (count), total_stock (sum of stock), avg_price (avg of price rounded to 2 decimals). The intermediate model must NOT appear in the database — it compiles into a CTE.",
    desc_pt: "Crie models/intermediate/int_electronics.sql materializado como EPHEMERAL filtrando ref('stg_products') para category = 'Electronics'. Depois crie models/mart/fct_electronics_stock.sql como TABLE que o referencia, com colunas: products (count), total_stock (soma de stock), avg_price (média de price com 2 casas). O model intermediário NÃO deve aparecer no banco — ele compila para um CTE.",
    hint: "int_electronics.sql:\n{{ config(materialized='ephemeral') }}\nselect * from {{ ref('stg_products') }} where category = 'Electronics'\n\nfct_electronics_stock.sql:\nselect count(*) as products, sum(stock) as total_stock,\n  round(avg(price), 2) as avg_price\nfrom {{ ref('int_electronics') }}",
    explanation_en: "Ephemeral models are pure refactoring tools: they DRY up logic without creating database objects. dbt inlines them as CTEs into every model that refs them — check the SQL panel to see it.",
    explanation_pt: "Models ephemeral são ferramentas de refatoração: organizam a lógica sem criar objetos no banco. O dbt os injeta como CTEs em cada model que os referencia — veja no painel SQL.",
    seed: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_products.sql": STG_PRODUCTS_SQL,
      "models/intermediate/int_electronics.sql": "-- ephemeral filter on stg_products\n",
      "models/mart/fct_electronics_stock.sql": "-- aggregate the intermediate model\n",
    },
    solution: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/staging/stg_products.sql": STG_PRODUCTS_SQL,
      "models/intermediate/int_electronics.sql": `{{ config(materialized='ephemeral') }}

select * from {{ ref('stg_products') }}
where category = 'Electronics'
`,
      "models/mart/fct_electronics_stock.sql": `select
  count(*) as products,
  sum(stock) as total_stock,
  round(avg(price), 2) as avg_price
from {{ ref('int_electronics') }}
`,
    },
    validate: {
      target: "fct_electronics_stock",
      mustMaterialize: { int_electronics: "ephemeral", fct_electronics_stock: "table" },
      mustUseRef: ["int_electronics", "stg_products"],
    },
  },
  {
    id: "m7", diff: "HARD", xp: 70,
    title: "incremental_orders",
    desc_en: "Create models/mart/inc_orders_log.sql materialized as INCREMENTAL: select id as order_id, customer_id, total_amount, order_date from the raw.orders source. Add an {% if is_incremental() %} block so warm runs only insert rows where order_date > (select max(order_date) from {{ this }}).",
    desc_pt: "Crie models/mart/inc_orders_log.sql materializado como INCREMENTAL: selecione id as order_id, customer_id, total_amount, order_date do source raw.orders. Adicione um bloco {% if is_incremental() %} para que execuções seguintes insiram apenas linhas com order_date > (select max(order_date) from {{ this }}).",
    hint: "{{ config(materialized='incremental') }}\nselect id as order_id, customer_id, total_amount, order_date\nfrom {{ source('raw', 'orders') }}\n{% if is_incremental() %}\nwhere order_date > (select max(order_date) from {{ this }})\n{% endif %}",
    explanation_en: "Incremental models trade full rebuilds for appends: the first run creates the table, later runs only INSERT what the is_incremental() filter lets through. {{ this }} refers to the already-materialized table itself.",
    explanation_pt: "Models incrementais trocam rebuilds completos por appends: a primeira execução cria a tabela, as seguintes só inserem o que o filtro is_incremental() deixa passar. {{ this }} referencia a própria tabela já materializada.",
    seed: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/mart/inc_orders_log.sql": "-- incremental model with an is_incremental() gate\n",
    },
    solution: {
      "dbt_project.yml": PROJECT_YML,
      "models/sources.yml": SOURCES_YML,
      "models/mart/inc_orders_log.sql": `{{ config(materialized='incremental') }}

select
  id as order_id,
  customer_id,
  total_amount,
  order_date
from {{ source('raw', 'orders') }}
{% if is_incremental() %}
where order_date > (select max(order_date) from {{ this }})
{% endif %}
`,
    },
    validate: {
      target: "inc_orders_log",
      mustMaterialize: { inc_orders_log: "incremental" },
      mustUseSource: ["raw.orders"],
      rawMustMatch: "is_incremental\\s*\\(",
      rawMustMatchLabel: "uses an {% if is_incremental() %} gate",
    },
  },
];

export const DBT_TRACK_TOTAL = DBT_MISSIONS.length + 1; // + tutorial
export const DBT_TRACK_XP = DBT_MISSIONS.reduce((a, m) => a + m.xp, 0) + DBT_TUTORIAL.xp;
