const nullable = type => ({ type: [type, 'null'] });
const object = properties => ({
  type: 'object', additionalProperties: false,
  properties, required: Object.keys(properties)
});

const receiptSchema = object({
  isReceipt: { type: 'boolean' },
  merchant: nullable('string'),
  date: nullable('string'),
  currency: nullable('string'),
  subtotal: nullable('number'),
  tax: nullable('number'),
  tip: nullable('number'),
  total: nullable('number'),
  items: {
    type: 'array',
    items: object({
      description: nullable('string'),
      quantity: nullable('number'),
      unitPrice: nullable('number'),
      total: nullable('number')
    })
  },
  warnings: { type: 'array', items: { type: 'string' } }
});

// Validate extracted objects before returning them to clients.
function matchesSchema(value, schema) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (value === null) return types.includes('null');
  if (types.includes('object')) {
    return typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).every(key => key in schema.properties) &&
      schema.required.every(key => Object.hasOwn(value, key) && matchesSchema(value[key], schema.properties[key]));
  }
  if (types.includes('array')) return Array.isArray(value) && value.every(item => matchesSchema(item, schema.items));
  if (types.includes('number')) return typeof value === 'number' && Number.isFinite(value);
  return types.includes(typeof value);
}

function validateReceipt(value) {
  if (!matchesSchema(value, receiptSchema)) throw new Error('Invalid receipt extraction structure.');
  if (value.date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    Number.isNaN(new Date(value.date).getTime()) || new Date(value.date).toISOString().slice(0, 10) !== value.date)) {
    throw new Error('Invalid extracted receipt date.');
  }
  if (value.currency !== null && !/^[A-Z]{3}$/.test(value.currency)) throw new Error('Invalid extracted currency.');
  return value;
}

module.exports = { receiptSchema, validateReceipt };
