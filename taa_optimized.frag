#version 450

layout(constant_id = 0) const int WINDOW_R = 1;

layout(location = 0) out vec4 color;

layout(location = 0) in vec2 texCoord;

layout(binding = 0) uniform sampler2D colorTex;

layout(push_constant) uniform params_t
{
    vec2 offset;
    float gamma;
    float t;
} params;

vec3 rgb2ycbcr(vec3 rgb) 
{   
    vec3 ycbcr;
    ycbcr.x = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
    ycbcr.y = -0.1146 * rgb.r - 0.3854 * rgb.g + 0.5 * rgb.b;
    ycbcr.z = 0.5 * rgb.r - 0.4542 * rgb.g - 0.0458 * rgb.b;
    return ycbcr;
}

vec3 ycbcr2rgb(vec3 ycbcr) 
{
    vec3 rgb;
    rgb.x = ycbcr.x + 1.5748 * ycbcr.z;
    rgb.y = ycbcr.x - 0.1873 * ycbcr.y - 0.4681 * ycbcr.z;
    rgb.z = ycbcr.x + 1.8556 * ycbcr.y;
    return rgb;
}

void taa3x3()
{
    const vec2 t = vec2((ivec2(gl_FragCoord.xy) & 1) * -2 + 1);

    vec3 mean = vec3(0);
    vec3 sigma = vec3(0);
    
    vec3 texel_0 = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-1, 1) * t * params.offset, 0).rgb);
    vec3 texel_1 = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 1, 1) * t * params.offset, 0).rgb);
    mean += texel_0 + texel_1;
    sigma += texel_0 * texel_0 + texel_1 * texel_1;
    texel_1 += dFdxFine(texel_1) * t.x;
    mean += texel_1;
    sigma += texel_1 * texel_1;
    mean += mean + dFdyFine(mean) * t.y;
    sigma += sigma + dFdyFine(sigma) * t.y;

    texel_0 = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-1, -1) * t * params.offset, 0).rgb);
    texel_1 = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 1, -1) * t * params.offset, 0).rgb);
    mean += texel_0 + texel_1;
    sigma += texel_0 * texel_0 + texel_1 * texel_1;
    texel_1 += dFdxFine(texel_1) * t.x;
    mean += texel_1;
    sigma += texel_1 * texel_1;

    float d = (2 * WINDOW_R + 1) * (2 * WINDOW_R + 1);
    mean /= d;
    sigma = sqrt(sigma / d - mean * mean);

    vec3 minC = mean - params.gamma * sigma;
    vec3 maxC = mean + params.gamma * sigma;

    color = vec4(ycbcr2rgb(mix(minC, maxC, params.t)), 1.0);
}

void taa5x5()
{
    const vec2 t = vec2((ivec2(gl_FragCoord.xy) & 1) * -2 + 1);

    vec3 mean = vec3(0);
    vec3 sigma = vec3(0);
    
    vec3 texels[9];
    texels[0] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-2, -2) * t * params.offset, 0).rgb);
    texels[1] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 0, -2) * t * params.offset, 0).rgb);
    texels[2] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 2, -2) * t * params.offset, 0).rgb);
    texels[3] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-2,  0) * t * params.offset, 0).rgb);
    texels[4] = rgb2ycbcr(textureLod(colorTex, texCoord, 0).rgb);
    texels[5] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 2,  0) * t * params.offset, 0).rgb);
    texels[6] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-2,  2) * t * params.offset, 0).rgb);
    texels[7] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 0,  2) * t * params.offset, 0).rgb);
    texels[8] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 2,  2) * t * params.offset, 0).rgb);

    for (int i = 3; i <= 8; ++i)
    {
        mean += texels[i];
        sigma += texels[i] * texels[i]; 
    }

    mean += dFdxFine(mean) * t.x;
    sigma += dFdxFine(sigma) * t.x;

    mean += texels[4] + texels[5] + texels[7] + texels[8];
    sigma += texels[4] * texels[4] + texels[5] * texels[5] + texels[7] * texels[7] + texels[8] * texels[8];

    mean += dFdyFine(mean) * t.y;
    sigma += dFdyFine(sigma) * t.y;

    mean += texels[1] + texels[2] + texels[4] + texels[5] + texels[7] + texels[8];
    sigma +=  texels[1] * texels[1] + texels[2] * texels[2] + texels[4] * texels[4] + texels[5] * texels[5] + texels[7] * texels[7] + texels[8] * texels[8];

    mean += dFdxFine(mean) * t.x;
    sigma += dFdxFine(sigma) * t.x;

    for (int i = 0; i <= 8; ++i)
    {
        mean += texels[i];
        sigma += texels[i] * texels[i]; 
    }

    float d = (2 * WINDOW_R + 1) * (2 * WINDOW_R + 1);
    mean /= d;
    sigma = sqrt(sigma / d - mean * mean);

    vec3 minC = mean - params.gamma * sigma;
    vec3 maxC = mean + params.gamma * sigma;

    color = vec4(ycbcr2rgb(mix(minC, maxC, params.t)), 1.0);
}

void taa7x7()
{
    const vec2 t = vec2((ivec2(gl_FragCoord.xy) & 1) * -2 + 1);

    vec3 mean = vec3(0);
    vec3 sigma = vec3(0);
    
    vec3 texels[16];
    texels[0]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-3, -3) * t * params.offset, 0).rgb);
    texels[1]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-1, -3) * t * params.offset, 0).rgb);
    texels[2]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 1, -3) * t * params.offset, 0).rgb);
    texels[3]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 3, -3) * t * params.offset, 0).rgb);
    texels[4]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-3, -1) * t * params.offset, 0).rgb);
    texels[5]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-1, -1) * t * params.offset, 0).rgb);
    texels[6]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 1, -1) * t * params.offset, 0).rgb);
    texels[7]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 3, -1) * t * params.offset, 0).rgb);
    texels[8]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-3,  1) * t * params.offset, 0).rgb); 
    texels[9]  = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-1,  1) * t * params.offset, 0).rgb);
    texels[10] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 1,  1) * t * params.offset, 0).rgb);
    texels[11] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 3,  1) * t * params.offset, 0).rgb);
    texels[12] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-3,  3) * t * params.offset, 0).rgb); 
    texels[13] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2(-1,  3) * t * params.offset, 0).rgb);
    texels[14] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 1,  3) * t * params.offset, 0).rgb);
    texels[15] = rgb2ycbcr(textureLod(colorTex, texCoord + vec2( 3,  3) * t * params.offset, 0).rgb);

    for (int i = 4; i <= 15; ++i)
    {
        mean += texels[i];
        sigma += texels[i] * texels[i]; 
    }

    mean += dFdxFine(mean) * t.x;
    sigma += dFdxFine(sigma) * t.x;

    mean += texels[5] + texels[6] + texels[7] + texels[9] + texels[10] + texels[11] + texels[13] + texels[14] + texels[15];
    sigma += texels[5] * texels[5] + texels[6] * texels[6] + texels[7] * texels[7] + texels[9] * texels[9] 
        + texels[10] * texels[10] + texels[11] * texels[11] + texels[13] * texels[13] + texels[14] * texels[14] + texels[15] * texels[15];

    mean += dFdyFine(mean) * t.y;
    sigma += dFdyFine(sigma) * t.y;

    mean += texels[1] + texels[2] + texels[3] + texels[5] + texels[6] + texels[7] 
        + texels[9] + texels[10] + texels[11] + texels[13] + texels[14] + texels[15];
    sigma += texels[1] * texels[1] + texels[2] * texels[2] + texels[3] * texels[3] + texels[5] * texels[5] + texels[6] * texels[6] 
        + texels[7] * texels[7] + texels[9] * texels[9] + texels[10] * texels[10] + texels[11] * texels[11] + texels[13] * texels[13] + texels[14] * texels[14] + texels[15] * texels[15];

    mean += dFdxFine(mean) * t.x;
    sigma += dFdxFine(sigma) * t.x;

    for (int i = 0; i <= 15; ++i)
    {
        mean += texels[i];
        sigma += texels[i] * texels[i]; 
    }

    float d = (2 * WINDOW_R + 1) * (2 * WINDOW_R + 1);
    mean /= d;
    sigma = sqrt(sigma / d - mean * mean);

    vec3 minC = mean - params.gamma * sigma;
    vec3 maxC = mean + params.gamma * sigma;

    color = vec4(ycbcr2rgb(mix(minC, maxC, params.t)), 1.0);
}

void main() 
{
    if (WINDOW_R == 1)
        taa3x3();
    else if (WINDOW_R == 2)
        taa5x5();
    else if (WINDOW_R == 3)
        taa7x7();
}