// .eslintrc.js
module.exports = {
    rules: {
      'no-multi-supabase-clients': {
        create(context) {
          return {
            ImportDeclaration(node) {
              if (
                node.source.value === '@supabase/supabase-js' &&
                node.specifiers.some((s) => s.imported?.name === 'createClient')
              ) {
                context.report({
                  node,
                  message:
                    'Avoid creating multiple Supabase clients. Use the shared client from lib/supabaseClient.',
                });
              }
            },
          };
        },
      },
    },
  };
  