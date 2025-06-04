-- insert_sample_template.sql

-- Insert the sample template
INSERT INTO templates (
  template_name,
  layout,
  color_scheme,
  commit,
  industry,
  theme,
  brand,
  data
) VALUES (
  'example-template',
  'default',
  'blue',
  '',
  'demo',
  'dark',
  'blue',
  jsonb_build_object(
    'pages', jsonb_build_array(
      jsonb_build_object(
        'id', 'index',
        'slug', 'index',
        'title', 'Sample Page',
        'content_blocks', jsonb_build_array(
          jsonb_build_object('type', 'text', 'value', 'Welcome to the playground!'),
          jsonb_build_object('type', 'image', 'value', jsonb_build_object('url', 'https://placekitten.com/800/400', 'alt', 'A cute kitten')),
          jsonb_build_object('type', 'video', 'value', jsonb_build_object('url', 'https://www.w3schools.com/html/mov_bbb.mp4', 'caption', 'Example video')),
          jsonb_build_object('type', 'audio', 'value', jsonb_build_object('provider', 'soundcloud', 'url', 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293', 'title', 'Sound demo')),
          jsonb_build_object('type', 'quote', 'value', jsonb_build_object('text', 'The best way to predict the future is to invent it.', 'author', 'Alan Kay')),
          jsonb_build_object('type', 'button', 'value', jsonb_build_object('label', 'Click Me', 'href', 'https://example.com', 'style', 'primary')),
          jsonb_build_object('type', 'grid', 'value', jsonb_build_object(
            'columns', 2,
            'items', jsonb_build_array(
              jsonb_build_object('type', 'text', 'value', 'Left column text block'),
              jsonb_build_object('type', 'image', 'value', jsonb_build_object('url', 'https://placebear.com/400/200', 'alt', 'A bear'))
            )
          ))
        )
      )
    )
  )
);

-- Rollback: delete by name
DELETE FROM templates WHERE template_name = 'example-template';
