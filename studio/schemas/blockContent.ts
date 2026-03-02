import { defineType, defineArrayMember } from 'sanity'

export const blockContent = defineType({
  name: 'blockContent',
  title: 'Block Content',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'H2', value: 'h2' },
        { title: 'H3', value: 'h3' },
        { title: 'H4', value: 'h4' },
        { title: 'Quote', value: 'blockquote' },
      ],
      lists: [
        { title: 'Bullet', value: 'bullet' },
        { title: 'Numbered', value: 'number' },
      ],
      marks: {
        decorators: [
          { title: 'Strong', value: 'strong' },
          { title: 'Emphasis', value: 'em' },
          { title: 'Underline', value: 'underline' },
          { title: 'Code', value: 'code' },
        ],
        annotations: [
          {
            name: 'link',
            type: 'object',
            title: 'Link',
            fields: [
              {
                name: 'href',
                type: 'url',
                title: 'URL',
                validation: (Rule) =>
                  Rule.uri({ scheme: ['http', 'https', 'mailto'] }),
              },
              {
                name: 'blank',
                type: 'boolean',
                title: 'Open in new tab',
                initialValue: false,
              },
            ],
          },
        ],
      },
    }),
    defineArrayMember({
      name: 'imageBlock',
      type: 'object',
      title: 'Image',
      fields: [
        {
          name: 'asset',
          type: 'image',
          title: 'Image',
          options: { hotspot: true },
        },
        {
          name: 'alt',
          type: 'string',
          title: 'Alt text',
          validation: (Rule) => Rule.required(),
        },
        {
          name: 'caption',
          type: 'string',
          title: 'Caption',
        },
      ],
      preview: {
        select: { media: 'asset', subtitle: 'alt' },
        prepare({ media, subtitle }: { media: unknown; subtitle: string }) {
          return { title: 'Image', media, subtitle }
        },
      },
    }),
    defineArrayMember({
      name: 'callout',
      type: 'object',
      title: 'Callout',
      fields: [
        {
          name: 'type',
          type: 'string',
          title: 'Type',
          options: {
            list: [
              { title: 'Info', value: 'info' },
              { title: 'Warning', value: 'warning' },
              { title: 'Danger', value: 'danger' },
            ],
          },
          validation: (Rule) => Rule.required(),
        },
        {
          name: 'body',
          type: 'text',
          title: 'Body',
          validation: (Rule) => Rule.required(),
        },
      ],
      preview: {
        select: { subtitle: 'type', description: 'body' },
        prepare({ subtitle, description }: { subtitle: string; description: string }) {
          return { title: 'Callout', subtitle, description }
        },
      },
    }),
    defineArrayMember({
      name: 'codeBlock',
      type: 'object',
      title: 'Code Block',
      fields: [
        {
          name: 'language',
          type: 'string',
          title: 'Language',
          options: {
            list: [
              { title: 'Plain text', value: 'text' },
              { title: 'JavaScript', value: 'javascript' },
              { title: 'TypeScript', value: 'typescript' },
              { title: 'Bash', value: 'bash' },
              { title: 'JSON', value: 'json' },
              { title: 'HTML', value: 'html' },
              { title: 'CSS', value: 'css' },
            ],
          },
          initialValue: 'text',
        },
        {
          name: 'code',
          type: 'text',
          title: 'Code',
          validation: (Rule) => Rule.required(),
        },
      ],
      preview: {
        select: { subtitle: 'language', description: 'code' },
        prepare({ subtitle, description }: { subtitle: string; description: string }) {
          return { title: 'Code Block', subtitle, description }
        },
      },
    }),
  ],
})
