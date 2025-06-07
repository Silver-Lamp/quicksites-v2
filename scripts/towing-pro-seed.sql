insert into public.starter_templates (id, name, description, template_id, preview, data)
values (
  'towing-pro',
  'Towing Pro',
  'Clean, bold starter for roadside assistance',
  'template-clean',
  'towing-pro.thumb.png',
  '{
    "blocks": [
      {
        "type": "hero",
        "content": {
          "headline": "Fast, Reliable Roadside Help",
          "subheadline": "24/7 towing and assistance, wherever you are.",
          "cta_text": "Call Now",
          "cta_link": "#contact"
        }
      },
      {
        "type": "services",
        "content": {
          "items": [
            "24/7 Towing",
            "Jump Starts",
            "Flat Tire Fix",
            "Lockouts",
            "Fuel Delivery"
          ]
        }
      }
    ]
  }'::jsonb
) on conflict (id) do update set data = excluded.data;
