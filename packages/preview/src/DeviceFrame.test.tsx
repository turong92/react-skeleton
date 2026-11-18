import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DeviceFrame } from './DeviceFrame'

describe('DeviceFrame', () => {
  it('the screen box is the device viewport and the outer box adds the insets', () => {
    const html = renderToStaticMarkup(
      <DeviceFrame kind="phone" screen={{ width: 390, height: 844 }}>
        x
      </DeviceFrame>,
    )
    expect(html).toContain('data-kind="phone"')
    expect(html).toContain('width:406px;height:860px')
    expect(html).toContain('width:390px;height:844px')
  })
})
